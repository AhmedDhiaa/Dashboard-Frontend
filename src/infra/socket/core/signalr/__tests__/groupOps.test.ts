/**
 * Coverage for the SignalR group helpers. We don't spin up a real hub
 * connection — instead we hand-build a minimal `SignalRInternal` shape with
 * a stub `connection.invoke` and assert behavior:
 *   - join/leave round-trip through the underlying invoke method
 *   - join updates `currentGroups`; leave removes the entry
 *   - rejoinGroups replays everything in `currentGroups` against the hub
 *   - errors during a rejoin don't reject the umbrella promise (Promise.allSettled)
 */

import { describe, it, expect, vi } from "vitest"
import { joinGroup, leaveGroup, rejoinGroups } from "../groupOps"
import { setConnectionState } from "../stateOps"
import { SignalRConnectionError } from "../../types"
import type { SignalRInternal } from "../internal"

function makeStub(opts: { connected?: boolean; invoke?: (method: string, ...args: unknown[]) => Promise<unknown> }): {
  self: SignalRInternal
  invokeSpy: ReturnType<typeof vi.fn>
} {
  const invokeSpy = vi.fn(opts.invoke ?? (async () => undefined))
  const self: SignalRInternal = {
    connection: { invoke: invokeSpy } as unknown as SignalRInternal["connection"],
    config: {} as SignalRInternal["config"],
    reconnectAttempts: 0,
    currentGroups: new Set<string>(),
    eventHandlers: new Map(),
    connectionState: opts.connected ? "connected" : "disconnected",
    connectionId: null,
    connectedAt: null,
    lastError: null,
    connectionLock: null,
    connect: async () => undefined,
    disconnect: async () => undefined,
    isConnected: () => Boolean(opts.connected),
    getConnectionInfo: () => ({
      state: opts.connected ? "connected" : "disconnected",
      connectionId: null,
      reconnectAttempts: 0,
      connectedAt: null,
      lastError: null,
    }),
  }
  return { self, invokeSpy }
}

describe("joinGroup", () => {
  it("calls JoinGroup on the hub and tracks the group when connected", async () => {
    const { self, invokeSpy } = makeStub({ connected: true })
    await joinGroup(self, "orders:42")
    expect(invokeSpy).toHaveBeenCalledWith("JoinGroup", "orders:42")
    expect(self.currentGroups.has("orders:42")).toBe(true)
  })

  it("throws SignalRConnectionError before reaching the hub when not connected", async () => {
    const { self, invokeSpy } = makeStub({ connected: false })
    await expect(joinGroup(self, "x")).rejects.toBeInstanceOf(SignalRConnectionError)
    expect(invokeSpy).not.toHaveBeenCalled()
  })

  it("propagates hub-side errors and does NOT add the group to the set", async () => {
    const boom = new Error("hub closed mid-call")
    const { self, invokeSpy } = makeStub({
      connected: true,
      invoke: async () => {
        throw boom
      },
    })
    await expect(joinGroup(self, "fail")).rejects.toBe(boom)
    expect(invokeSpy).toHaveBeenCalledTimes(1)
    expect(self.currentGroups.has("fail")).toBe(false)
  })
})

describe("leaveGroup", () => {
  it("calls LeaveGroup and removes from currentGroups when connected", async () => {
    const { self, invokeSpy } = makeStub({ connected: true })
    self.currentGroups.add("orders:42")
    await leaveGroup(self, "orders:42")
    expect(invokeSpy).toHaveBeenCalledWith("LeaveGroup", "orders:42")
    expect(self.currentGroups.has("orders:42")).toBe(false)
  })

  it("is a silent no-op when not connected (no throw, no invoke)", async () => {
    const { self, invokeSpy } = makeStub({ connected: false })
    self.currentGroups.add("orders:42")
    await expect(leaveGroup(self, "orders:42")).resolves.toBeUndefined()
    expect(invokeSpy).not.toHaveBeenCalled()
    // Group stays in the set so a future connect+rejoin can still cover it.
    expect(self.currentGroups.has("orders:42")).toBe(true)
  })

  it("propagates hub-side errors during leave", async () => {
    const boom = new Error("rate limited")
    const { self } = makeStub({
      connected: true,
      invoke: async () => {
        throw boom
      },
    })
    self.currentGroups.add("orders:42")
    await expect(leaveGroup(self, "orders:42")).rejects.toBe(boom)
  })
})

describe("rejoinGroups", () => {
  it("returns early when there are no groups to rejoin", async () => {
    const { self, invokeSpy } = makeStub({ connected: true })
    await rejoinGroups(self)
    expect(invokeSpy).not.toHaveBeenCalled()
  })

  it("re-issues a JoinGroup invocation for every tracked group", async () => {
    const { self, invokeSpy } = makeStub({ connected: true })
    self.currentGroups.add("a")
    self.currentGroups.add("b")
    await rejoinGroups(self)
    expect(invokeSpy).toHaveBeenCalledTimes(2)
    expect(invokeSpy).toHaveBeenCalledWith("JoinGroup", "a")
    expect(invokeSpy).toHaveBeenCalledWith("JoinGroup", "b")
  })

  it("does NOT reject the umbrella promise even when individual rejoins fail", async () => {
    const calls: string[] = []
    const { self } = makeStub({
      connected: true,
      invoke: async (_method, group) => {
        calls.push(group as string)
        if (group === "b") throw new Error("denied")
        return undefined
      },
    })
    self.currentGroups.add("a")
    self.currentGroups.add("b")
    self.currentGroups.add("c")
    // Promise.allSettled inside rejoinGroups means the umbrella resolves
    // even though "b" rejected; the other two still reach the hub.
    await expect(rejoinGroups(self)).resolves.toBeUndefined()
    expect(calls).toEqual(expect.arrayContaining(["a", "b", "c"]))
  })
})

describe("setConnectionState", () => {
  it("flips the state slot and notifies subscribers of socket:state_changed", () => {
    const { self } = makeStub({ connected: false })
    const stateHandler = vi.fn()
    self.eventHandlers.set("socket:state_changed", new Set([stateHandler]))
    setConnectionState(self, "connecting")
    expect(self.connectionState).toBe("connecting")
    expect(stateHandler).toHaveBeenCalledWith("connecting")
  })

  it("fires the 'connected' event with connection info on transitioning to connected", () => {
    const { self } = makeStub({ connected: false })
    const connectedHandler = vi.fn()
    self.eventHandlers.set("connected", new Set([connectedHandler]))
    self.getConnectionInfo = () => ({
      state: "connected",
      connectionId: "abc",
      reconnectAttempts: 0,
      connectedAt: new Date(0),
      lastError: null,
    })
    setConnectionState(self, "connected")
    expect(connectedHandler).toHaveBeenCalledWith(expect.objectContaining({ connectionId: "abc" }))
  })

  it("fires the 'disconnected' event with the lastError on disconnect/fail", () => {
    const { self } = makeStub({ connected: true })
    const disconnectedHandler = vi.fn()
    self.eventHandlers.set("disconnected", new Set([disconnectedHandler]))
    self.lastError = new Error("network")
    setConnectionState(self, "disconnected")
    expect(disconnectedHandler).toHaveBeenCalledWith(self.lastError)

    setConnectionState(self, "failed")
    expect(disconnectedHandler).toHaveBeenCalledTimes(2)
  })
})
