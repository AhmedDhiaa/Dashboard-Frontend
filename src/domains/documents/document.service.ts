/**
 * Document Storage Service
 * Handles file uploads with FormData and document management.
 *
 * The ABP transport (multipart POST/PUT, by-ref lookup) lives in
 * `adapters/abp/crud-extras`; this service builds the domain payloads.
 */

import { BaseCRUDService } from "@/infra/api"
import { abpPostFormData, abpPutFormData, abpGetByPath } from "@/infra/api/adapters/abp/crud-extras"
import type { Document, DocumentCreateInput, DocumentUpdateInput } from "./types"

class DocumentService extends BaseCRUDService<Document, DocumentCreateInput, DocumentUpdateInput> {
  constructor() {
    super("/document")
  }

  // Override create to handle FormData
  override create(data: DocumentCreateInput): Promise<Document> {
    const formData = new FormData()
    formData.append("RefId", data.refId)
    formData.append("RefType", data.refType.toString())
    formData.append("FileData", data.fileData)
    if (data.note) formData.append("Note", data.note)
    return abpPostFormData<Document>(this.endpoint, formData)
  }

  // Override update to handle FormData
  override update(id: string, data: DocumentUpdateInput): Promise<Document> {
    const formData = new FormData()
    if (data.refId) formData.append("RefId", data.refId)
    if (data.refType !== undefined) formData.append("RefType", data.refType.toString())
    if (data.fileData) formData.append("FileData", data.fileData)
    if (data.note) formData.append("Note", data.note)
    return abpPutFormData<Document>(`${this.endpoint}/${id}`, formData)
  }

  // Special method: create main document
  createMain(data: DocumentCreateInput): Promise<Document> {
    const formData = new FormData()
    formData.append("RefId", data.refId)
    formData.append("RefType", data.refType.toString())
    formData.append("FileData", data.fileData)
    if (data.note) formData.append("Note", data.note)
    return abpPostFormData<Document>(`${this.endpoint}/main`, formData)
  }

  // Get documents by reference — ABP uses path params: /document/by-ref/{refId}/{refType}
  getByRef(refId: string, refType: number): Promise<Document[]> {
    return abpGetByPath<Document[]>(this.endpoint, "by-ref", refId, refType)
  }
}

export const documentService = new DocumentService()
