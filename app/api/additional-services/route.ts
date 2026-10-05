import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getAdditionalServices } from '@/lib/additionalServices';
import { serviceIconKey } from '@/lib/serviceIcons';

// Always run on request, so the web app sees changes from the Products & Services page right away
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
 * GET /api/additional-services — public. Active services in the order set on the Products &
 * Services page, for the web app's Additional Services step. A service with terms must have its
 * terms accepted (that version) before the customer can choose it.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const services = (await getAdditionalServices())
      .filter(s => s.active)
      .map(s => ({
        id: s.id,
        name: s.name,
        summary: s.summary,
        details: s.details,
        icon: serviceIconKey(s.id, s.icon),
        ...(s.termsText
          ? { termsTitle: s.termsTitle || `${s.name} Terms and Conditions`, termsText: s.termsText, termsVersion: s.termsVersion }
          : {}),
      }));
    return NextResponse.json({ success: true, data: services }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Additional services] Public list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load services' }, { status: 500, headers: corsHeaders });
  }
}
