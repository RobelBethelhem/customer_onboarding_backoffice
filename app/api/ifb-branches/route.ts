import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import IfbBranchSettings from '@/lib/models/IfbBranchSettings';
import { requireRole } from '@/lib/apiAuth';
import { audit } from '@/lib/audit';
import { defaultIfbMappings, getIfbMappings } from '@/lib/ifbBranches';

// Always run on request (a pre-rendered route would freeze the data and reject PUT with 405)
export const dynamic = 'force-dynamic';

const CODE = /^\d{2,5}$/;

/** GET /api/ifb-branches — the conventional → IFB branch table (admin) plus the rule-based defaults */
export async function GET(request: NextRequest) {
  const denied = requireRole(request, ['admin']);
  if (denied) return denied;
  try {
    await connectToDatabase();
    const mappings = await getIfbMappings();
    const doc = await IfbBranchSettings.findById('default').select('updatedBy updatedAt').lean() as any;
    return NextResponse.json({
      success: true,
      data: { mappings, updatedBy: doc?.updatedBy, updatedAt: doc?.updatedAt, defaults: defaultIfbMappings() },
    });
  } catch (error) {
    console.error('[IFB Branches] Load error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load IFB branch codes' }, { status: 500 });
  }
}

/** PUT /api/ifb-branches — replace the table. Body: { mappings: [{ conventionalCode, ifbCode, branchName }] } */
export async function PUT(request: NextRequest) {
  const denied = requireRole(request, ['admin']);
  if (denied) return denied;
  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.mappings)) {
      return NextResponse.json({ success: false, error: 'mappings must be a list' }, { status: 400 });
    }

    const mappings = body.mappings.map((m: any) => ({
      conventionalCode: String(m?.conventionalCode ?? '').trim(),
      ifbCode: String(m?.ifbCode ?? '').trim(),
      branchName: String(m?.branchName ?? '').trim().slice(0, 120),
    }));
    const conventional = new Set<string>();
    const ifb = new Set<string>();
    for (const m of mappings) {
      const label = m.branchName || m.conventionalCode || 'a row';
      if (!CODE.test(m.conventionalCode) || !CODE.test(m.ifbCode)) {
        return NextResponse.json({ success: false, error: `Branch codes must be numbers (${label})` }, { status: 400 });
      }
      if (m.conventionalCode === m.ifbCode) {
        return NextResponse.json({ success: false, error: `Branch ${m.conventionalCode} is mapped to itself` }, { status: 400 });
      }
      if (conventional.has(m.conventionalCode)) {
        return NextResponse.json({ success: false, error: `Branch ${m.conventionalCode} is listed twice` }, { status: 400 });
      }
      if (ifb.has(m.ifbCode)) {
        return NextResponse.json({ success: false, error: `IFB code ${m.ifbCode} is used for two branches` }, { status: 400 });
      }
      conventional.add(m.conventionalCode);
      ifb.add(m.ifbCode);
    }
    const clash = Array.from(ifb).find(code => conventional.has(code));
    if (clash) {
      return NextResponse.json({ success: false, error: `${clash} is both a conventional and an IFB code` }, { status: 400 });
    }

    const before = new Map<string, string>((await getIfbMappings()).map(m => [m.conventionalCode, m.ifbCode] as [string, string]));
    const after = new Map<string, string>(mappings.map((m: any) => [m.conventionalCode, m.ifbCode] as [string, string]));
    const updatedBy = request.headers.get('x-user-name') || request.headers.get('x-user-email') || 'admin';
    await IfbBranchSettings.findByIdAndUpdate('default', { $set: { mappings, updatedBy } }, { upsert: true });

    const changes = Array.from(new Set([...Array.from(before.keys()), ...Array.from(after.keys())]))
      .filter(code => before.get(code) !== after.get(code))
      .map(code => ({ field: `branch ${code}`, oldValue: before.get(code) ?? null, newValue: after.get(code) ?? null }));
    if (changes.length) {
      await audit(request, {
        module: 'SETTINGS', action: 'UPDATE', entityType: 'IfbBranchSettings', entityId: 'default',
        entityName: 'IFB branch codes', changes,
        description: `Changed IFB branch codes for ${changes.length} branch${changes.length === 1 ? '' : 'es'}`,
      });
    }

    return NextResponse.json({ success: true, data: { mappings } });
  } catch (error) {
    console.error('[IFB Branches] Save error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save IFB branch codes' }, { status: 500 });
  }
}
