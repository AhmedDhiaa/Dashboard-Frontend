/**
 * Document Reference Type Enumeration
 * Used to link documents to different entities in the system
 */

export const DOCUMENT_REF_TYPE = {
  ITEM: 1,
  TICKET: 2,
  ORDER: 3,
  INVOICE: 4,
  EMPLOYEE: 5,
  BANNER: 6,
  VEHICLE: 7,
  WAREHOUSE: 8,
} as const

/**
 * Mapping of entity names to their document reference types
 */
export const ENTITY_REF_TYPE_MAP: Record<string, number> = {
  item: DOCUMENT_REF_TYPE.ITEM,
  ticket: DOCUMENT_REF_TYPE.TICKET,
  order: DOCUMENT_REF_TYPE.ORDER,
  invoice: DOCUMENT_REF_TYPE.INVOICE,
  employee: DOCUMENT_REF_TYPE.EMPLOYEE,
  banner: DOCUMENT_REF_TYPE.BANNER,
  vehicle: DOCUMENT_REF_TYPE.VEHICLE,
  warehouse: DOCUMENT_REF_TYPE.WAREHOUSE,
}
