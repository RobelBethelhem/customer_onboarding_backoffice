import mongoose, { Schema, Document } from 'mongoose';

// A file an organization uploaded (document scan or specimen signature). Kept apart from the
// application so its size never counts against MongoDB's 16 MB document limit. Uploads that no
// application uses are deleted when `expiresAt` passes (TTL index).
export interface ICorporateFile extends Document {
  fileId: string;
  keyHash: string;              // SHA-256 of the key given to the uploader (proves it is theirs)
  applicationId?: string;       // set when an application uses the file
  kind: 'document' | 'signature';
  fileName: string;
  mimeType: string;
  size: number;
  data: Buffer;
  expiresAt?: Date | null;
}

const CorporateFileSchema = new Schema<ICorporateFile>({
  fileId: { type: String, required: true, unique: true },
  keyHash: { type: String, required: true },
  applicationId: { type: String, default: '' },
  kind: { type: String, enum: ['document', 'signature'], required: true },
  fileName: { type: String, default: '' },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  data: { type: Buffer, required: true },
  expiresAt: { type: Date, default: null },
}, { timestamps: true });

CorporateFileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.CorporateFile || mongoose.model<ICorporateFile>('CorporateFile', CorporateFileSchema);
