/**
 * Document Storage Service
 * Handles file uploads with FormData and document management
 */

import { BaseCRUDService } from "@/infra/api"
import { apiClient } from "@/infra/api"
import type { Document, DocumentCreateInput, DocumentUpdateInput } from "./types"

class DocumentService extends BaseCRUDService<Document, DocumentCreateInput, DocumentUpdateInput> {
  constructor() {
    super("/document")
  }

  // Override create to handle FormData
  override async create(data: DocumentCreateInput): Promise<Document> {
    const formData = new FormData()
    formData.append("RefId", data.refId)
    formData.append("RefType", data.refType.toString())
    formData.append("FileData", data.fileData)
    if (data.note) formData.append("Note", data.note)

    const response = await apiClient.post<Document>(this.endpoint, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    return response.data
  }

  // Override update to handle FormData
  override async update(id: string, data: DocumentUpdateInput): Promise<Document> {
    const formData = new FormData()
    if (data.refId) formData.append("RefId", data.refId)
    if (data.refType !== undefined) formData.append("RefType", data.refType.toString())
    if (data.fileData) formData.append("FileData", data.fileData)
    if (data.note) formData.append("Note", data.note)

    const response = await apiClient.put<Document>(`${this.endpoint}/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    return response.data
  }

  // Special method: create main document
  async createMain(data: DocumentCreateInput): Promise<Document> {
    const formData = new FormData()
    formData.append("RefId", data.refId)
    formData.append("RefType", data.refType.toString())
    formData.append("FileData", data.fileData)
    if (data.note) formData.append("Note", data.note)

    const response = await apiClient.post<Document>(`${this.endpoint}/main`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    return response.data
  }

  // Get documents by reference — ABP uses path params: /document/by-ref/{refId}/{refType}
  async getByRef(refId: string, refType: number): Promise<Document[]> {
    const response = await apiClient.get<Document[]>(
      `${this.endpoint}/by-ref/${encodeURIComponent(refId)}/${refType}`,
    )
    return response.data
  }
}

export const documentService = new DocumentService()
