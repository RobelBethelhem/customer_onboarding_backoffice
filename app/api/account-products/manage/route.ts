import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import AccountProductSettings, { IAccountClass, IAccountProduct } from '@/lib/models/AccountProducts';
import { requireRole } from '@/lib/apiAuth';
import { audit } from '@/lib/audit';
import { defaultAccountProducts, getAccountProducts } from '@/lib/accountProducts';

// Always run on request (a pre-rendered route would freeze the data and reject PUT with 405)
export const dynamic = 'force-dynamic';

const MANAGERS = ['kyc', 'admin'] as const;
const bad = (error: string) => NextResponse.json({ success: false, error }, { status: 400 });

const amount = (v: unknown): number | null | undefined => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined; // undefined = invalid
};

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product';

const describeClass = (c: IAccountClass) =>
  `${c.name} · ${c.interestRate === null ? 'no interest' : `${c.interestRate}%`} · min ${c.minBalance ?? '—'}` +
  `${c.maxBalance !== null ? ` to ${c.maxBalance}` : ''} · ${c.active ? 'active' : 'inactive'}`;

/** GET /api/account-products/manage — full catalog incl. inactive items (KYC officers, admin) */
export async function GET(request: NextRequest) {
  const denied = requireRole(request, [...MANAGERS]);
  if (denied) return denied;
  try {
    await connectToDatabase();
    const products = await getAccountProducts();
    const doc = await AccountProductSettings.findById('default').select('updatedBy updatedAt').lean() as any;
    return NextResponse.json({
      success: true,
      data: { products, updatedBy: doc?.updatedBy, updatedAt: doc?.updatedAt, defaults: defaultAccountProducts() },
    });
  } catch (error) {
    console.error('[Products] Load error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load account products' }, { status: 500 });
  }
}

/** PUT /api/account-products/manage — replace the catalog (order = display order). Body: { products } */
export async function PUT(request: NextRequest) {
  const denied = requireRole(request, [...MANAGERS]);
  if (denied) return denied;
  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.products)) return bad('products must be a list');

    const products: IAccountProduct[] = [];
    const ids = new Set<string>();
    const codes = new Set<string>();
    for (const p of body.products) {
      const name = String(p?.name ?? '').trim().slice(0, 100);
      if (!name) return bad('Every product needs a name');
      let id = String(p?.id ?? '').trim() || slug(name);
      while (ids.has(id)) id = `${id}-2`;
      ids.add(id);
      if (!Array.isArray(p?.classes)) return bad(`${name}: classes must be a list`);

      const classes: IAccountClass[] = [];
      for (const c of p.classes) {
        const code = String(c?.code ?? '').trim().toUpperCase();
        const className = String(c?.name ?? '').trim().slice(0, 120);
        if (!className) return bad(`${name}: every account class needs a name`);
        if (!/^[A-Z0-9]{2,10}$/.test(code)) return bad(`${className}: the code must be 2–10 letters or digits`);
        if (codes.has(code)) return bad(`Code ${code} is used twice`);
        codes.add(code);
        const interestRate = amount(c?.interestRate);
        const minBalance = amount(c?.minBalance);
        const maxBalance = amount(c?.maxBalance);
        if (interestRate === undefined || (interestRate !== null && interestRate > 100)) return bad(`${className}: interest rate must be 0–100 (or empty)`);
        if (minBalance === undefined || maxBalance === undefined) return bad(`${className}: balances must be positive numbers (or empty)`);
        if (minBalance !== null && maxBalance !== null && maxBalance < minBalance) return bad(`${className}: maximum balance is below the minimum`);
        const productNumber = String(c?.productNumber ?? '').trim();
        if (productNumber && !/^\d{1,5}$/.test(productNumber)) return bad(`${className}: product number must be digits`);
        classes.push({
          code, name: className, interestRate, minBalance, maxBalance, productNumber,
          remarks: String(c?.remarks ?? '').trim().slice(0, 300),
          active: c?.active !== false,
        });
      }
      products.push({
        id, name, classes,
        description: String(p?.description ?? '').trim().slice(0, 300),
        isIFB: p?.isIFB === true,
        audience: ['individual', 'organization', 'both'].includes(p?.audience) ? p.audience : 'individual',
        active: p?.active !== false,
      });
    }

    // Audit: one line per product / class that was added, removed, changed or moved
    const flatten = (list: IAccountProduct[]) => new Map(list.flatMap((p, pi) => [
      [`product ${p.id}`, `#${pi + 1} ${p.name}${p.isIFB ? ' (IFB)' : ''} · for ${p.audience || 'individual'} · ${p.active ? 'active' : 'inactive'}`] as [string, string],
      ...p.classes.map((c, ci) => [`class ${c.code}`, `${p.name} #${ci + 1} · ${describeClass(c)}`] as [string, string]),
    ]));
    const before = flatten(await getAccountProducts());
    const after = flatten(products);
    const updatedBy = request.headers.get('x-user-name') || request.headers.get('x-user-email') || 'unknown';
    await AccountProductSettings.findByIdAndUpdate('default', { $set: { products, updatedBy } }, { upsert: true });

    const changes = Array.from(new Set([...Array.from(before.keys()), ...Array.from(after.keys())]))
      .filter(k => before.get(k) !== after.get(k))
      .map(k => ({ field: k, oldValue: before.get(k) ?? null, newValue: after.get(k) ?? null }));
    if (changes.length) {
      await audit(request, {
        module: 'SETTINGS', action: 'UPDATE', entityType: 'AccountProducts', entityId: 'default',
        entityName: 'Account products', changes,
        description: `Changed account products (${changes.length} item${changes.length === 1 ? '' : 's'})`,
      });
    }

    return NextResponse.json({ success: true, data: { products } });
  } catch (error) {
    console.error('[Products] Save error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save account products' }, { status: 500 });
  }
}
