/**
 * Document Types
 */

export interface Document {
  id: string
  refId: string
  refType: number
  fileData?: string
  fileName?: string
  fileUrl?: string
  note?: string
  createdAt?: string
  updatedAt?: string
}

export interface DocumentCreateInput {
  refId: string
  refType: number
  fileData: File
  note?: string
}

export interface DocumentUpdateInput {
  id: string
  refId?: string
  refType?: number
  fileData?: File
  note?: string
}
