// The documents a foreign national gives with an application (kept free of mongoose so dashboard
// pages can import it): a passport, and a work permit or an Origin ID (Ethiopian origin) — either.

export const FOREIGN_DOCUMENT_TYPES = {
  passport: 'Passport',
  work_permit: 'Work permit',
  origin_id: 'Origin ID',
} as const;

export type ForeignDocumentType = keyof typeof FOREIGN_DOCUMENT_TYPES;

export interface ForeignDocument {
  type: ForeignDocumentType;
  fileId: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date | string;
}
