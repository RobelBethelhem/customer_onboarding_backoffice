import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getAccountProducts } from '@/lib/accountProducts';

// Always run on request, so the web app sees changes from the Account Products page right away
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
 * GET /api/account-products — public. Active products with their active account classes, in the
 * order set on the Account Products page, for the web app's Account Type step.
 */
export async function GET(request: Request) {
  // ?for=organization: products organizations can open (business account wizard); default individuals
  const forOrganizations = new URL(request.url).searchParams.get('for') === 'organization';
  const offered = (audience?: string) => (audience || 'individual') === 'both'
    || (audience || 'individual') === (forOrganizations ? 'organization' : 'individual');
  try {
    await connectToDatabase();
    const products = (await getAccountProducts())
      .filter(p => p.active && offered(p.audience))
      .map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        isIFB: p.isIFB,
        classes: p.classes.filter(c => c.active).map(({ active, ...c }) => c),
      }))
      .filter(p => p.classes.length > 0);
    return NextResponse.json({ success: true, data: products }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Products] Public list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load account products' }, { status: 500, headers: corsHeaders });
  }
}
