import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import CorporateCatalogSettings, {
  ICorporateCategory, ICorporateDocumentType, ICorporateRules, ICorporateSubtype,
} from '@/lib/models/CorporateCatalog';
import { requireRole } from '@/lib/apiAuth';
import { audit } from '@/lib/audit';
import { defaultCorporateCategories, getCorporateCatalog } from '@/lib/corporateCatalog';
import { DEFAULT_CORPORATE_RULES } from '@/lib/corporateCatalogDefaults';

// Always run on request (a pre-rendered route would freeze the data and reject PUT with 405)
export const dynamic = 'force-dynamic';

const MANAGERS = ['kyc', 'admin'] as const;
const bad = (error: string) => NextResponse.json({ success: false, error }, { status: 400 });
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const slug = (name: string, fallback: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || fallback;

/** A free id: the given one (kept so existing applications still match) or one made from the name */
function uniqueId(given: unknown, name: string, taken: Set<string>, fallback: string): string {
  let id = str(given, 40).replace(/[^a-z0-9_-]/gi, '') || slug(name, fallback);
  const base = id;
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
  taken.add(id);
  return id;
}

const wholeNumber = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** GET /api/corporate/catalog — organization categories, documents and rules incl. inactive ones */
export async function GET(request: NextRequest) {
  const denied = requireRole(request, [...MANAGERS, 'senior_approver']);
  if (denied) return denied;
  try {
    await connectToDatabase();
    const { categories, rules } = await getCorporateCatalog();
    const doc = await CorporateCatalogSettings.findById('default').select('updatedBy updatedAt').lean() as any;
    return NextResponse.json({
      success: true,
      data: {
        categories, rules, updatedBy: doc?.updatedBy, updatedAt: doc?.updatedAt,
        defaults: { categories: defaultCorporateCategories(), rules: { ...DEFAULT_CORPORATE_RULES } },
      },
    });
  } catch (error) {
    console.error('[Corporate] Catalog load error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load the business account settings' }, { status: 500 });
  }
}

/** PUT /api/corporate/catalog — replace categories (order = display order) and rules. Body: { categories, rules } */
export async function PUT(request: NextRequest) {
  const denied = requireRole(request, [...MANAGERS]);
  if (denied) return denied;
  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.categories)) return bad('categories must be a list');
    if (body.categories.length > 30) return bad('At most 30 categories');

    const categories: ICorporateCategory[] = [];
    const categoryIds = new Set<string>();
    for (const c of body.categories) {
      const name = str(c?.name, 100);
      if (!name) return bad('Every category needs a name');
      const id = uniqueId(c?.id, name, categoryIds, 'category');
      if (!Array.isArray(c?.subtypes) || !Array.isArray(c?.documents)) return bad(`${name}: sub-types and documents must be lists`);
      if (c.subtypes.length > 30) return bad(`${name}: at most 30 sub-types`);
      if (c.documents.length > 40) return bad(`${name}: at most 40 documents`);

      const subtypeIds = new Set<string>();
      const subtypes: ICorporateSubtype[] = [];
      for (const s of c.subtypes) {
        const subName = str(s?.name, 100);
        if (!subName) return bad(`${name}: every sub-type needs a name`);
        subtypes.push({ id: uniqueId(s?.id, subName, subtypeIds, 'subtype'), name: subName, active: s?.active !== false });
      }

      const documentIds = new Set<string>();
      const documents: ICorporateDocumentType[] = [];
      for (const d of c.documents) {
        const docName = str(d?.name, 150);
        if (!docName) return bad(`${name}: every document needs a name`);
        documents.push({
          id: uniqueId(d?.id, docName, documentIds, 'document'),
          name: docName,
          description: str(d?.description, 400),
          required: d?.required !== false,
          subtypes: Array.isArray(d?.subtypes) ? Array.from(new Set<string>(d.subtypes.map(String))).filter(sid => subtypeIds.has(sid)) : [],
          active: d?.active !== false,
        });
      }
      categories.push({ id, name, description: str(c?.description, 400), subtypes, documents, active: c?.active !== false });
    }
    if (!categories.some(c => c.active)) return bad('Keep at least one category active');

    const r = body.rules || {};
    const maxPeople = wholeNumber(r.maxPeople, 1, 10);
    const maxFileMb = wholeNumber(r.maxFileMb, 1, 10);
    const inviteValidDays = wholeNumber(r.inviteValidDays, 1, 30);
    if (maxPeople === null) return bad('People per application: 1 to 10');
    if (maxFileMb === null) return bad('File size limit: 1 to 10 MB');
    if (inviteValidDays === null) return bad('Verification links: valid for 1 to 30 days');
    const rules: ICorporateRules = { maxPeople, maxFileMb, inviteValidDays, signatureRequired: r.signatureRequired !== false };

    // Audit: one line per category / sub-type / document / rule that was added, removed or changed
    const flatten = (list: ICorporateCategory[], rl: ICorporateRules) => new Map<string, string>([
      ...list.flatMap((c, ci) => [
        [`category ${c.id}`, `#${ci + 1} ${c.name} · ${c.active ? 'active' : 'inactive'}`] as [string, string],
        ...c.subtypes.map(s => [`${c.id} / sub-type ${s.id}`, `${s.name} · ${s.active ? 'active' : 'inactive'}`] as [string, string]),
        ...c.documents.map((d, di) => [`${c.id} / document ${d.id}`,
          `#${di + 1} ${d.name} · ${d.required ? 'required' : 'optional'}${d.subtypes.length ? ` · only ${d.subtypes.join(', ')}` : ''} · ${d.active ? 'active' : 'inactive'}`] as [string, string]),
      ]),
      ['rule maxPeople', String(rl.maxPeople)], ['rule maxFileMb', String(rl.maxFileMb)],
      ['rule inviteValidDays', String(rl.inviteValidDays)], ['rule signatureRequired', String(rl.signatureRequired)],
    ]);
    const current = await getCorporateCatalog();
    const before = flatten(current.categories, current.rules);
    const after = flatten(categories, rules);
    const updatedBy = request.headers.get('x-user-name') || request.headers.get('x-user-email') || 'unknown';
    await CorporateCatalogSettings.findByIdAndUpdate('default', { $set: { categories, rules, updatedBy } }, { upsert: true });

    const changes = Array.from(new Set([...Array.from(before.keys()), ...Array.from(after.keys())]))
      .filter(k => before.get(k) !== after.get(k))
      .map(k => ({ field: k, oldValue: before.get(k) ?? null, newValue: after.get(k) ?? null }));
    if (changes.length) {
      await audit(request, {
        module: 'SETTINGS', action: 'UPDATE', entityType: 'CorporateCatalog', entityId: 'default',
        entityName: 'Business account documents', changes,
        description: `Changed business account categories, documents or rules (${changes.length} item${changes.length === 1 ? '' : 's'})`,
      });
    }
    return NextResponse.json({ success: true, data: { categories, rules } });
  } catch (error) {
    console.error('[Corporate] Catalog save error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save the business account settings' }, { status: 500 });
  }
}
