import { describe, it, expect } from "vitest"
import { parseSwagger, clusterEndpoints } from "../parser"
import { ABP_FIXTURE } from "./fixture"

describe("parseSwagger", () => {
  it("walks every operation under doc.paths", () => {
    const result = parseSwagger(ABP_FIXTURE)
    // 5 resources × (GET list + POST create + GET detail + PUT update + DELETE) = 25
    // + 1 custom action (close)
    expect(result.endpoints.length).toBe(26)
    expect(result.info?.title).toBe("Acme API")
  })

  it("extracts component schemas keyed by name", () => {
    const result = parseSwagger(ABP_FIXTURE)
    expect(result.schemas.OrderDto).toBeDefined()
    expect(result.schemas.OrderDto?.properties?.code?.type).toBe("string")
  })

  it("captures path parameters as ParsedParam[]", () => {
    const result = parseSwagger(ABP_FIXTURE)
    const detail = result.endpoints.find(e => e.method === "GET" && e.path === "/api/app/order/{id}")
    expect(detail?.pathParams.map(p => p.name)).toEqual(["id"])
  })

  it("captures requestBody schema for POST endpoints", () => {
    const result = parseSwagger(ABP_FIXTURE)
    const create = result.endpoints.find(e => e.method === "POST" && e.path === "/api/app/order")
    expect(create?.requestSchema?.type).toBe("object")
    expect(create?.requestSchema?.properties?.code).toBeDefined()
  })
})

describe("clusterEndpoints", () => {
  it("groups CRUD paths under a single cluster name", () => {
    const result = parseSwagger(ABP_FIXTURE)
    const clusters = clusterEndpoints(result.endpoints)
    expect(clusters.map(c => c.name)).toContain("order")
    expect(clusters.map(c => c.name)).toContain("user")
    expect(clusters.length).toBe(5) // exactly the five fixture resources
  })

  it("classifies list / create / detail / update / delete by method + path shape", () => {
    const result = parseSwagger(ABP_FIXTURE)
    const orderCluster = clusterEndpoints(result.endpoints).find(c => c.name === "order")!
    expect(orderCluster.list?.method).toBe("GET")
    expect(orderCluster.list?.path).toBe("/api/app/order")
    expect(orderCluster.create?.method).toBe("POST")
    expect(orderCluster.detail?.path).toBe("/api/app/order/{id}")
    expect(orderCluster.update?.method).toBe("PUT")
    expect(orderCluster.delete?.method).toBe("DELETE")
  })

  it("accumulates non-CRUD endpoints under customActions", () => {
    const result = parseSwagger(ABP_FIXTURE)
    const orderCluster = clusterEndpoints(result.endpoints).find(c => c.name === "order")!
    expect(orderCluster.customActions.length).toBe(1)
    expect(orderCluster.customActions[0]!.path).toBe("/api/app/order/{id}/close")
  })
})
