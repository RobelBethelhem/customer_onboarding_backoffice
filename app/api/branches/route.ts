import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getBranches } from '@/lib/ifbBranches';

// Always run on request, so the web app sees the admin's latest changes
export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/branches — public. Active branches for the customer web app's branch step, in the shape
 * the web app uses. Maintained by the admin in Settings → Branches.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const branches = (await getBranches())
      .map((b, i) => ({
        id: i + 1,
        name: b.branchName,
        category: b.category,
        type: b.branchType,
        latitude: b.latitude,
        longitude: b.longitude,
        branchCode: b.conventionalCode,
        ifbCode: b.ifbCode || '',
        active: b.active,
      }))
      .filter(b => b.active)
      .map(({ active, ...b }) => b);
    return NextResponse.json({ success: true, data: branches }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Branches] Public list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load branches' }, { status: 500, headers: corsHeaders });
  }
}
