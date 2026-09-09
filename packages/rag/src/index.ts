export const SUPPORTED_DOCUMENT_TYPES = ["application/pdf", "text/plain", "text/markdown", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/csv", "application/json"] as const;

export function isSupportedDocumentType(mimeType: string) {
  return SUPPORTED_DOCUMENT_TYPES.includes(mimeType as (typeof SUPPORTED_DOCUMENT_TYPES)[number]);
}
