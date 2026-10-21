'use client';

import { Globe, FileText, Download, ExternalLink, AlertTriangle } from 'lucide-react';
import { fileUrl } from '@/lib/corporateTypes';
import { FOREIGN_DOCUMENT_TYPES, ForeignDocument } from '@/lib/foreignDocumentTypes';

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * A foreign national's passport and work permit / Origin ID, for the KYC review. The files are
 * served by /api/corporate/files (KYC, Senior Approver, admin); other roles see that they are there.
 */
export default function ForeignDocumentsPanel({ nationality, documents, canView }: {
  nationality: string;
  documents: Pick<ForeignDocument, 'type' | 'fileId' | 'fileName' | 'mimeType' | 'size'>[];
  canView: boolean;
}) {
  const passport = documents.find(d => d.type === 'passport');
  const permit = documents.find(d => d.type === 'work_permit' || d.type === 'origin_id');
  const missing = [!passport && 'passport', !permit && 'work permit or Origin ID'].filter(Boolean).join(' and ');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
          <Globe className="w-5 h-5 text-sky-700" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Foreign National Documents</h2>
          <p className="text-sm text-gray-500">
            Nationality (Fayda): <span className="font-medium text-gray-800">{nationality || '-'}</span> · a passport and a work permit or Origin ID are required
          </p>
        </div>
      </div>

      {missing && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> Missing: {missing}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[passport, permit].filter(Boolean).map(d => {
          const doc = d!;
          const isImage = doc.mimeType.startsWith('image/');
          return (
            <div key={doc.fileId} className="rounded-xl border-2 border-sky-100 overflow-hidden">
              <div className="px-4 py-2 bg-sky-50 text-sm font-semibold text-sky-900">{FOREIGN_DOCUMENT_TYPES[doc.type]}</div>
              {canView && isImage ? (
                <a href={fileUrl(doc.fileId)} target="_blank" rel="noreferrer" title="Open full size">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(doc.fileId)} alt={FOREIGN_DOCUMENT_TYPES[doc.type]} className="w-full max-h-80 object-contain bg-white" />
                </a>
              ) : (
                <div className="h-28 flex items-center justify-center bg-gray-50">
                  <FileText className="w-10 h-10 text-gray-300" />
                  {!isImage && <span className="ml-2 text-xs font-bold text-red-500">PDF</span>}
                </div>
              )}
              <div className="px-4 py-3 flex items-center justify-between gap-3 border-t border-gray-100">
                <div className="min-w-0 text-sm">
                  <p className="text-gray-800 truncate">{doc.fileName || FOREIGN_DOCUMENT_TYPES[doc.type]}</p>
                  <p className="text-xs text-gray-400">{size(doc.size)}</p>
                </div>
                {canView ? (
                  <div className="flex gap-2 shrink-0">
                    <a href={fileUrl(doc.fileId)} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
                      <ExternalLink className="w-3.5 h-3.5" /> Open
                    </a>
                    <a href={fileUrl(doc.fileId, true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 shrink-0">Visible to KYC</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
