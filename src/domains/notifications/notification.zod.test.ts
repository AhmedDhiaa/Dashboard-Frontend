import { getNotificationCreateSchema, getNotificationUpdateSchema } from "./notification.schema"

describe("notification zod schema", () => {
  const t = (key: string) => key // dummy translation

  it("should validate correct data for create", () => {
    const schema = getNotificationCreateSchema(t)
    const valid = schema.safeParse({
      note: "Test note",
      type: 1,
      title: "Test Title",
      body: "Test Body",
      baseId: "123e4567-e89b-12d3-a456-426614174000",
      baseRef: "REF-001",
      baseEntityType: 1,
      userInfo: { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6" },
    })
    expect(valid.success).toBe(true)
  })

  it("should fail for missing required fields", () => {
    const schema = getNotificationCreateSchema(t)
    const invalid = schema.safeParse({})
    expect(invalid.success).toBe(false)
  })

  it("should validate correct data for update", () => {
    const schema = getNotificationUpdateSchema(t)
    const valid = schema.safeParse({
      note: "Test note",
      type: 1,
      title: "Test Title",
      body: "Test Body",
      baseId: "123e4567-e89b-12d3-a456-426614174000",
      baseRef: "REF-001",
      baseEntityType: 1,
      userInfo: { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6" },
      concurrencyStamp: "abc",
    })
    expect(valid.success).toBe(true)
  })

  it("should fail update if concurrencyStamp missing", () => {
    const schema = getNotificationUpdateSchema(t)
    const invalid = schema.safeParse({
      note: "Test note",
      type: 1,
      title: "Test Title",
      body: "Test Body",
      baseId: "123e4567-e89b-12d3-a456-426614174000",
      baseRef: "REF-001",
      baseEntityType: 1,
      userInfo: { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6" },
    })
    expect(invalid.success).toBe(false)
  })
})
