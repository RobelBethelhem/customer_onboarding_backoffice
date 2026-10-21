import CorporateFile from '@/lib/models/CorporateFile';
import { matchesHash } from '@/lib/corporate';
import { FOREIGN_DOCUMENT_TYPES, ForeignDocumentType, ForeignDocument } from '@/lib/foreignDocumentTypes';

// A foreign national's passport and work permit / Origin ID, uploaded by the web app before the
// application is sent (POST /api/corporate/public/files, after the Fayda verification) and kept in
// the same file store as business account documents — not inside the application.

interface Ref { type: ForeignDocumentType; fileId: string; fileKey: string }

/**
 * The documents of a foreign national's application: a passport and either a work permit or an
 * Origin ID. New uploads must come with their key; when amending a returned application, files it
 * already holds may be sent again without one. `fileId` names an upload to do again.
 */
export async function checkForeignDocuments(
  input: unknown, ownApplicationId?: string
): Promise<{ documents: ForeignDocument[]; newFileIds: string[] } | { error: string; fileId?: string }> {
  const byType = new Map<ForeignDocumentType, Ref>();
  for (const r of (Array.isArray(input) ? input : []).slice(0, 6)) {
    const type = String(r?.type || '') as ForeignDocumentType;
    const fileId = String(r?.fileId || '').slice(0, 64);
    if (type in FOREIGN_DOCUMENT_TYPES && fileId) byType.set(type, { type, fileId, fileKey: String(r?.fileKey || '') });
  }
  if (!byType.has('passport')) return { error: 'Please upload your passport. It is required for foreign nationals.' };
  if (!byType.has('work_permit') && !byType.has('origin_id')) {
    return { error: 'Please upload your work permit or your Origin ID.' };
  }

  const refs = Array.from(byType.values());
  const files = await CorporateFile.find({ fileId: { $in: refs.map(r => r.fileId) } })
    .select('fileId keyHash applicationId kind fileName mimeType size createdAt').lean() as any[];
  const documents: ForeignDocument[] = [];
  const newFileIds: string[] = [];
  for (const ref of refs) {
    const file = files.find(f => f.fileId === ref.fileId);
    const label = ref.type === 'origin_id' ? FOREIGN_DOCUMENT_TYPES[ref.type] : FOREIGN_DOCUMENT_TYPES[ref.type].toLowerCase();
    const again = { fileId: ref.fileId };
    if (!file || file.kind !== 'document') return { error: `Your ${label} upload has expired. Please upload it again.`, ...again };
    if (file.applicationId) {
      if (file.applicationId !== ownApplicationId) {
        return { error: `Your ${label} was already sent with another application. Please upload it again.`, ...again };
      }
    } else {
      if (!matchesHash(ref.fileKey, file.keyHash)) return { error: `Your ${label} upload has expired. Please upload it again.`, ...again };
      newFileIds.push(file.fileId);
    }
    documents.push({
      type: ref.type, fileId: file.fileId, fileName: file.fileName, mimeType: file.mimeType, size: file.size,
      uploadedAt: file.createdAt || new Date(),
    });
  }
  return { documents, newFileIds };
}

/** The new uploads now belong to the application: they stop expiring */
export async function claimForeignDocuments(fileIds: string[], applicationId: string): Promise<void> {
  if (!fileIds.length) return;
  const r = await CorporateFile.updateMany(
    { fileId: { $in: fileIds }, applicationId: '' },
    { $set: { applicationId, expiresAt: null } }
  );
  if (r.modifiedCount !== fileIds.length) {
    console.warn(`[Onboarding] ${applicationId}: ${fileIds.length - r.modifiedCount} document upload(s) were taken by another submission`);
  }
}
