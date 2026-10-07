import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getCorporateCatalog } from '@/lib/corporateCatalog';
import CorporateFile from '@/lib/models/CorporateFile';
import CorporateApplication from '@/lib/models/CorporateApplication';
import { checkEkycToken, cleanBase64 } from '@/lib/faydaTokens';
import { bad, text, newSecret, hashSecret, sameSecret, sniffMime, UNUSED_UPLOAD_MS } from '@/lib/corporate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/corporate/public/files — public (web app, through the Fayda backend). Stores one
 * document scan or specimen signature and returns its id plus a key that proves it is the
 * uploader's when the application is submitted.
 *
 * Only people who verified with Fayda can upload: the body carries the eKYC result the Fayda
 * backend signed, or — when replacing documents of a returned application — the application's
 * status-page key.
 *
 * Body: { kind: 'document' | 'signature', fileName, data (base64), ekycToken? | applicationId + key? }
 */
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json().catch(() => null);
    if (!body) return bad('Invalid request');

    const kind = body.kind === 'signature' ? 'signature' : body.kind === 'document' ? 'document' : '';
    if (!kind) return bad('Unknown file kind');

    // Who is uploading
    if (body.applicationId && body.key) {
      const app = await CorporateApplication.findOne({ applicationId: text(body.applicationId, 20) }).select('+accessKey status');
      if (!app || !sameSecret(String(body.key), app.accessKey)) return bad('Application not found', 404);
      if (app.status !== 'returned') return bad('This application is not waiting for new documents.', 409);
    } else {
      const check = await checkEkycToken(String(body.ekycToken || ''));
      if (check === 'unavailable') return bad('We could not check your Fayda verification right now. Please try again.', 503);
      if (check === 'invalid') return bad('Your Fayda verification has expired. Please verify with Fayda again.', 401);
    }

    const { rules } = await getCorporateCatalog();
    const data = Buffer.from(cleanBase64(body.data), 'base64');
    if (!data.length) return bad('The file is empty');
    if (data.length > rules.maxFileMb * 1024 * 1024) return bad(`The file is larger than ${rules.maxFileMb} MB. Please upload a smaller scan or photo.`, 413);

    const mimeType = sniffMime(data);
    if (!mimeType) return bad('Please upload a PDF, JPG, PNG or WEBP file.', 415);
    if (kind === 'signature' && mimeType === 'application/pdf') return bad('Please upload the signature as a photo or scan (JPG, PNG or WEBP).', 415);

    const fileId = crypto.randomUUID();
    const fileKey = newSecret();
    const fileName = text(body.fileName, 120).replace(/[\\/:*?"<>|\r\n]+/g, '_') || `${kind}.${mimeType.split('/')[1]}`;
    await CorporateFile.create({
      fileId,
      keyHash: hashSecret(fileKey),
      kind,
      fileName,
      mimeType,
      size: data.length,
      data,
      expiresAt: new Date(Date.now() + UNUSED_UPLOAD_MS),
    });

    return NextResponse.json({
      success: true,
      data: { fileId, fileKey, fileName, mimeType, size: data.length },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Corporate] Upload error:', error);
    return NextResponse.json({ success: false, error: 'Failed to store the file', detail: String(error?.message || error).slice(0, 300) }, { status: 500 });
  }
}
