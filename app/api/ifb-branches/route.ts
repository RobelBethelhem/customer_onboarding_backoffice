import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import IfbBranchSettings, { IBranch } from '@/lib/models/IfbBranchSettings';
import { requireRole } from '@/lib/apiAuth';
import { audit } from '@/lib/audit';
import { defaultBranches, getBranches } from '@/lib/ifbBranches';

// Always run on request (a pre-rendered route would freeze the data and reject PUT with 405)
export const dynamic = 'force-dynamic';

const CODE = /^\d{2,5}$/;
const bad = (error: string) => NextResponse.json({ success: false, error }, { status: 400 });

const coord = (v: unknown, min: number, max: number): number | null | undefined => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined; // undefined = invalid
};

const describe = (b: IBranch) =>
  `${b.branchName} · IFB ${b.ifbCode || '—'} · ${b.branchType} · ${b.category} · ${b.latitude ?? '—'},${b.longitude ?? '—'} · ${b.active ? 'active' : 'hidden'}`;

/** GET /api/ifb-branches — the full branch directory (admin) plus the default list */
export async function GET(request: NextRequest) {
  const denied = requireRole(request, ['admin']);
  if (denied) return denied;
  try {
    await connectToDatabase();
    const branches = await getBranches();
    const doc = await IfbBranchSettings.findById('default').select('updatedBy updatedAt').lean() as any;
    return NextResponse.json({
      success: true,
      data: { mappings: branches, updatedBy: doc?.updatedBy, updatedAt: doc?.updatedAt, defaults: defaultBranches() },
    });
  } catch (error) {
    console.error('[Branches] Load error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load branches' }, { status: 500 });
  }
}

/** PUT /api/ifb-branches — replace the directory. Body: { mappings: IBranch[] } */
export async function PUT(request: NextRequest) {
  const denied = requireRole(request, ['admin']);
  if (denied) return denied;
  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.mappings)) return bad('mappings must be a list');

    const branches: IBranch[] = [];
    const ifbOf = new Map<string, string>();   // conventional code → IFB code
    const ownerOf = new Map<string, string>(); // IFB code → conventional code
    for (const m of body.mappings) {
      const b: IBranch = {
        branchName: String(m?.branchName ?? '').trim().slice(0, 120),
        conventionalCode: String(m?.conventionalCode ?? '').trim(),
        ifbCode: String(m?.ifbCode ?? '').trim(),
        branchType: m?.branchType === 'Sub-branch' ? 'Sub-branch' : 'Branch',
        category: m?.category === 'Outline' ? 'Outline' : 'City',
        latitude: null,
        longitude: null,
        active: m?.active !== false,
      };
      const lat = coord(m?.latitude, -90, 90);
      const lng = coord(m?.longitude, -180, 180);
      const label = b.branchName || b.conventionalCode || 'a row';
      if (!b.branchName) return bad(`Every branch needs a name (code ${b.conventionalCode || '?'})`);
      if (!CODE.test(b.conventionalCode)) return bad(`Branch code must be a number (${label})`);
      if (b.ifbCode && !CODE.test(b.ifbCode)) return bad(`IFB code must be a number (${label})`);
      if (b.ifbCode === b.conventionalCode) return bad(`${label}: the IFB code is the same as the branch code`);
      if (lat === undefined || lng === undefined) return bad(`${label}: latitude/longitude are not valid coordinates`);
      b.latitude = lat;
      b.longitude = lng;

      // Two names may share a branch code (e.g. a sub-branch), but then they share one IFB code
      if (ifbOf.has(b.conventionalCode) && ifbOf.get(b.conventionalCode) !== b.ifbCode) {
        return bad(`Branch code ${b.conventionalCode} is listed with two different IFB codes`);
      }
      ifbOf.set(b.conventionalCode, b.ifbCode);
      if (b.ifbCode) {
        if (ownerOf.has(b.ifbCode) && ownerOf.get(b.ifbCode) !== b.conventionalCode) {
          return bad(`IFB code ${b.ifbCode} is used for two branch codes`);
        }
        ownerOf.set(b.ifbCode, b.conventionalCode);
      }
      branches.push(b);
    }
    const clash = Array.from(ownerOf.keys()).find(code => ifbOf.has(code));
    if (clash) return bad(`${clash} is both a branch code and an IFB code`);

    const key = (b: IBranch) => `${b.conventionalCode} ${b.branchName}`;
    const before = new Map((await getBranches()).map(b => [key(b), describe(b)]));
    const after = new Map(branches.map(b => [key(b), describe(b)]));
    const updatedBy = request.headers.get('x-user-name') || request.headers.get('x-user-email') || 'admin';
    await IfbBranchSettings.findByIdAndUpdate('default', { $set: { version: 2, mappings: branches, updatedBy } }, { upsert: true });

    const changes = Array.from(new Set([...Array.from(before.keys()), ...Array.from(after.keys())]))
      .filter(k => before.get(k) !== after.get(k))
      .map(k => ({ field: `branch ${k}`, oldValue: before.get(k) ?? null, newValue: after.get(k) ?? null }));
    if (changes.length) {
      await audit(request, {
        module: 'SETTINGS', action: 'UPDATE', entityType: 'IfbBranchSettings', entityId: 'default',
        entityName: 'Branch directory', changes,
        description: `Changed ${changes.length} branch${changes.length === 1 ? '' : 'es'} (${branches.length} in total)`,
      });
    }

    return NextResponse.json({ success: true, data: { mappings: branches } });
  } catch (error) {
    console.error('[Branches] Save error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save branches' }, { status: 500 });
  }
}
