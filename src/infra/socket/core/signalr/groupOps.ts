/**
 * SignalR group join/leave/rejoin
 */

import { logger } from "@/shared/logger"
import { SignalRConnectionError } from "../types"
import type { SignalRInternal } from "./internal"

export async function joinGroup(self: SignalRInternal, groupName: string): Promise<void> {
  if (!self.isConnected()) {
    throw new SignalRConnectionError("Cannot join group: not connected")
  }

  try {
    await self.connection!.invoke("JoinGroup", groupName)
    self.currentGroups.add(groupName)
    logger.debug(`[SignalR] Joined group: ${groupName}`)
  } catch (error) {
    logger.error(`[SignalR] Failed to join group: ${groupName}`, error)
    throw error
  }
}

export async function leaveGroup(self: SignalRInternal, groupName: string): Promise<void> {
  if (!self.isConnected()) {
    return
  }

  try {
    await self.connection!.invoke("LeaveGroup", groupName)
    self.currentGroups.delete(groupName)
    logger.debug(`[SignalR] Left group: ${groupName}`)
  } catch (error) {
    logger.error(`[SignalR] Failed to leave group: ${groupName}`, error)
    throw error
  }
}

export async function rejoinGroups(self: SignalRInternal): Promise<void> {
  if (self.currentGroups.size === 0) {
    return
  }

  logger.info(`[SignalR] Rejoining ${self.currentGroups.size} groups`)

  const rejoinPromises = Array.from(self.currentGroups).map(async groupName => {
    try {
      await self.connection!.invoke("JoinGroup", groupName)
      logger.debug(`[SignalR] Rejoined group: ${groupName}`)
    } catch (error) {
      logger.error(`[SignalR] Failed to rejoin group: ${groupName}`, error)
    }
  })

  await Promise.allSettled(rejoinPromises)
}
