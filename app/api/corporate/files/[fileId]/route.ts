import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import CorporateFile from '@/lib/models/CorporateFile';
import { requireRole } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/corporate/files/:fileId — a document or specimen signature of a submitted business
 * account application (KYC officers, Senior Approvers, admin). Only PDF / JPEG / PNG / WEBP are
 * ever stored (checked from the file's bytes on upload).
 */
export async function GET(request: NextRequest, { params }: { params: { fileId: string } }) {
  const denied = requireRole(request, ['admin', 'kyc', 'senior_approver']);
  if (denied) return denied;
  try {
    await connectToDatabase();
    const file = await CorporateFile.findOne({ fileId: String(params.fileId).slice(0, 64), applicationId: { $ne: '' } });
    if (!file) return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });

    const ascii = (file.fileName || 'file').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    const download = new URL(request.url).searchParams.get('download') === '1';
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(file.data.length),
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName || 'file')}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[Corporate] File error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load the file' }, { status: 500 });
  }
}
