import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getCorporateCatalog } from '@/lib/corporateCatalog';

// Always run on request, so the web app sees KYC's latest changes
export const dynamic = 'force-dynamic';

/**
 * GET /api/corporate/public/catalog — public (web app, through the Fayda backend). Organization
 * categories, their sub-types and the documents each one uploads, plus the application rules.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const { categories, rules } = await getCorporateCatalog();
    return NextResponse.json({
      success: true,
      data: {
        categories: categories
          .filter(c => c.active)
          .map(c => {
            const subtypes = c.subtypes.filter(s => s.active).map(s => ({ id: s.id, name: s.name }));
            const subtypeIds = new Set(subtypes.map(s => s.id));
            return {
              id: c.id,
              name: c.name,
              description: c.description,
              subtypes,
              documents: c.documents
                .filter(d => d.active && (!d.subtypes.length || d.subtypes.some(id => subtypeIds.has(id))))
                .map(d => ({
                  id: d.id, name: d.name, description: d.description, required: d.required,
                  subtypes: d.subtypes.filter(id => subtypeIds.has(id)),
                })),
            };
          }),
        rules: {
          maxPeople: rules.maxPeople,
          maxFileMb: rules.maxFileMb,
          signatureRequired: rules.signatureRequired,
          inviteValidDays: rules.inviteValidDays,
        },
      },
    });
  } catch (error) {
    console.error('[Corporate] Catalog error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load the business account options' }, { status: 500 });
  }
}
