import { describe, it, expect } from "vitest"
import { parseSwagger, clusterEndpoints } from "../parser"
import { generatePageFromCluster } from "../page-generator"
import { pageSchema } from "../../schema/page-schema"
import { ABP_FIXTURE } from "./fixture"

describe("generatePageFromCluster — Phase 5 acceptance", () => {
  it("produces a draft schema that round-trips through pageSchema.parse", () => {
    const result = parseSwagger(ABP_FIXTURE)
    const orderCluster = clusterEndpoints(result.endpoints).find(c => c.name === "order")!
    const { schema, warnings } = generatePageFromCluster(orderCluster, { schemas: result.schemas })
    expect(warnings).toEqual([])
    expect(() => pageSchema.parse(schema)).not.toThrow()
  })

  it("derives id/title/permission from the cluster name", () => {
    const result = parseSwagger(ABP_FIXTURE)
    const orderCluster = clusterEndpoints(result.endpoints).find(c => c.name === "order")!
    const { schema } = generatePageFromCluster(orderCluster, { schemas: result.schemas })
    expect(schema.id).toBe("order-list")
    expect(schema.title.en).toBe("Order")
    expect(schema.permission).toBe("Api.Order")
  })

  it("emits a single table block backed by the list endpoint", () => {
    const result = parseSwagger(ABP_FIXTURE)
    const orderCluster = clusterEndpoints(result.endpoints).find(c => c.name === "order")!
    const { schema } = generatePageFromCluster(orderCluster, { schemas: result.schemas })
    expect(schema.blocks.length).toBe(1)
    const block = schema.blocks[0] as unknown as { type: string; dataSource: { type: string; endpoint: string } }
    expect(block.type).toBe("table")
    expect(block.dataSource).toEqual({ type: "api", endpoint: "/api/app/order", method: "GET" })
  })

  it("auto-suggests columns from the response item shape (PagedResultDto unwrapping)", () => {
    const result = parseSwagger(ABP_FIXTURE)
    const orderCluster = clusterEndpoints(result.endpoints).find(c => c.name === "order")!
    const { schema } = generatePageFromCluster(orderCluster, { schemas: result.schemas })
    const block = schema.blocks[0] as unknown as { columns: { field: string; type: string }[] }
    const fieldNames = block.columns.map(c => c.field)
    expect(fieldNames).toContain("code")
    expect(fieldNames).toContain("name")
    expect(fieldNames).toContain("status")
    // creationTime → datetime column
    const creationTime = block.columns.find(c => c.field === "creationTime")
    expect(creationTime?.type).toBe("datetime")
    // status → enum (has enum constraint)
    const status = block.columns.find(c => c.field === "status")
    expect(status?.type).toBe("enum")
  })

  it("wires view / edit / delete row actions when those endpoints exist", () => {
    const result = parseSwagger(ABP_FIXTURE)
    const orderCluster = clusterEndpoints(result.endpoints).find(c => c.name === "order")!
    const { schema } = generatePageFromCluster(orderCluster, { schemas: result.schemas })
    const block = schema.blocks[0] as unknown as { rowActions: { id: string; action: { type: string } }[] }
    const ids = block.rowActions.map(a => a.id)
    expect(ids).toContain("view")
    expect(ids).toContain("edit")
    expect(ids).toContain("delete")
    // delete should be an api action (with confirm) — view + edit are navigates
    expect(block.rowActions.find(a => a.id === "delete")?.action.type).toBe("api")
    expect(block.rowActions.find(a => a.id === "view")?.action.type).toBe("navigate")
  })

  it("emits a row action for each customAction (close ticket use case)", () => {
    const result = parseSwagger(ABP_FIXTURE)
    const orderCluster = clusterEndpoints(result.endpoints).find(c => c.name === "order")!
    const { schema } = generatePageFromCluster(orderCluster, { schemas: result.schemas })
    const block = schema.blocks[0] as unknown as { rowActions: { id: string }[] }
    expect(block.rowActions.map(a => a.id)).toContain("close")
  })
})
