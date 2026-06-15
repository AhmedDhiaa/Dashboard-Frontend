/**
 * Ticket System - Type Definitions
 *
 * Complete type system for the ticket management subsystem
 */

/* ============================================================================
 * USER TYPES
 * ========================================================================== */

export interface User {
  id: string
  tenantId: string | null
  userName: string
  name: string
  surname: string | null
  email: string
  emailConfirmed: boolean
  phoneNumber: string | null
  phoneNumberConfirmed: boolean
  isActive: boolean
  lockoutEnabled: boolean
  accessFailedCount: number
  lockoutEnd: string | null
  concurrencyStamp: string
  entityVersion: number
  lastPasswordChangeTime: string
  isDeleted: boolean
  deleterId: string | null
  deletionTime: string | null
  lastModificationTime: string | null
  lastModifierId: string | null
  creationTime: string
  creatorId: string | null
  extraProperties: Record<string, unknown>
}

/**
 * Minimal customer/partner shape the ticket CRM surfaces render. The full
 * business-partner entity is part of the (removed) business domain; tickets only
 * need these display fields, so they're declared locally to keep the support
 * domain self-contained and white-label.
 */
export interface BusinessPartner {
  id?: string
  name?: string
  foreignName?: string
  code?: string
  phoneInfo?: { number?: string; countryCode?: string }
}

/* ============================================================================
 * TICKET BUSINESS PARTNER INFO
 * ========================================================================== */

export interface TicketBusinessPartnerInfo {
  id: string
  entity?: BusinessPartner
}

/* ============================================================================
 * TICKET MESSAGE TYPES
 * ========================================================================== */

export interface TicketMessage {
  id: string
  ticketId: string
  userInfo?: TicketBusinessPartnerInfo
  text: string
  date: string
  note?: string | null
  connectionId?: string | null
  tenantId?: string | null
  tenant?: unknown | null
  entityType?: number
  baseId?: string | null
  baseRef?: string | null
  baseEntityType?: number | null
  concurrencyStamp?: string
  creator?: User | null
  lastModifier?: User | null
  deleter?: User | null
  isDeleted?: boolean
  deleterId?: string | null
  deletionTime?: string | null
  lastModificationTime?: string | null
  lastModifierId?: string | null
  creationTime?: string
  creatorId?: string
}

/* ============================================================================
 * TICKET TYPES
 * ========================================================================== */

export enum TicketStatus {
  OPEN = 1,
  CLOSED = 2,
}

export interface Ticket {
  id: string
  number: number
  reference: string
  userInfo: TicketBusinessPartnerInfo
  date: string
  status: TicketStatus
  title: string
  messages: TicketMessage[] | null
  tenantId: string | null
  tenant: unknown | null
  entityType: number
  note: string | null
  baseId: string | null
  baseRef: string | null
  baseEntityType: number | null
  concurrencyStamp: string
  creator: User | null
  lastModifier: User | null
  deleter: User | null
  isDeleted: boolean
  deleterId: string | null
  deletionTime: string | null
  lastModificationTime: string | null
  lastModifierId: string | null
  creationTime: string
  creatorId: string | null
}

/* ============================================================================
 * INPUT TYPES
 * ========================================================================== */

export interface CreateTicketRequest {
  title: string
  note?: string
  status?: number
  userInfo: { id: string }
  concurrencyStamp?: string
}

export interface SendMessageRequest {
  ticketId: string
  text: string
  note?: string
  connectionId?: string
}

export interface UpdateMessageRequest {
  note?: string
  concurrencyStamp?: string
  text?: string
}
