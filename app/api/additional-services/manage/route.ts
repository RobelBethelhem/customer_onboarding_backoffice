import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import AdditionalServiceSettings, { IAdditionalService } from '@/lib/models/AdditionalServices';
import { requireRole } from '@/lib/apiAuth';
import { audit } from '@/lib/audit';
import { defaultAdditionalServices, getAdditionalServices } from '@/lib/additionalServices';
import { SERVICE_ICON_KEYS } from '@/lib/serviceIcons';

// Always run on request (a pre-rendered route would freeze the data and reject PUT with 405)
export const dynamic = 'force-dynamic';

const MANAGERS = ['kyc', 'admin'] as const;
const MAX_TERMS = 20000;
const bad = (error: string) => NextResponse.json({ success: false, error }, { status: 400 });

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'service';
const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/** GET /api/additional-services/manage — full catalog incl. inactive services (KYC officers, admin) */
export async function GET(request: NextRequest) {
  const denied = requireRole(request, [...MANAGERS]);
  if (denied) return denied;
  try {
    await connectToDatabase();
    const services = await getAdditionalServices();
    const doc = await AdditionalServiceSettings.findById('default').select('updatedBy updatedAt').lean() as any;
    return NextResponse.json({
      success: true,
      data: { services, updatedBy: doc?.updatedBy, updatedAt: doc?.updatedAt, defaults: defaultAdditionalServices(), icons: SERVICE_ICON_KEYS },
    });
  } catch (error) {
    console.error('[Additional services] Load error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load services' }, { status: 500 });
  }
}

/**
 * PUT /api/additional-services/manage — replace the catalog (order = display order). Body: { services }.
 * The terms version is kept by the server: it goes up by one whenever a service's terms text changes,
 * so each application records exactly which terms the customer accepted.
 */
export async function PUT(request: NextRequest) {
  const denied = requireRole(request, [...MANAGERS]);
  if (denied) return denied;
  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.services)) return bad('services must be a list');

    const previous = await getAdditionalServices();
    const prevById = new Map(previous.map(s => [s.id, s]));
    const now = new Date();
    const ids = new Set<string>();
    const services: IAdditionalService[] = [];

    for (const s of body.services) {
      const name = text(s?.name, 60);
      if (!name) return bad('Every service needs a name');
      // Existing services keep their id (applications refer to it); new ones get one from the name
      let id = String(s?.id ?? '').trim();
      if (id && !/^[a-z0-9_]{2,40}$/.test(id)) return bad(`${name}: invalid id`);
      if (!id) {
        id = slug(name);
        while (ids.has(id) || prevById.has(id)) id = `${id.slice(0, 37)}_${Math.floor(Math.random() * 90 + 10)}`;
      }
      if (ids.has(id)) return bad(`${name}: listed twice`);
      ids.add(id);

      const details = (Array.isArray(s?.details) ? s.details : String(s?.details ?? '').split('\n'))
        .map((d: unknown) => text(d, 160)).filter(Boolean);
      if (details.length > 10) return bad(`${name}: at most 10 points under "What does this mean?"`);

      const termsText = String(s?.termsText ?? '').replace(/\r\n/g, '\n').trim();
      if (termsText.length > MAX_TERMS) return bad(`${name}: terms and conditions are longer than ${MAX_TERMS} characters`);
      const prev = prevById.get(id);
      const termsChanged = termsText !== (prev?.termsText || '');
      const termsVersion = termsText && termsChanged ? (prev?.termsVersion || 0) + 1 : (prev?.termsVersion || 0);

      services.push({
        id, name, details,
        summary: text(s?.summary, 160),
        icon: (SERVICE_ICON_KEYS as readonly string[]).includes(s?.icon) ? s.icon : 'star',
        termsTitle: termsText ? text(s?.termsTitle, 120) || `${name} Terms and Conditions` : '',
        termsText,
        termsVersion,
        termsUpdatedAt: termsChanged && termsText ? now : (prev?.termsUpdatedAt || null),
        active: s?.active !== false,
      });
    }

    const updatedBy = request.headers.get('x-user-name') || request.headers.get('x-user-email') || 'unknown';
    await AdditionalServiceSettings.findByIdAndUpdate('default', { $set: { services, updatedBy } }, { upsert: true });

    // Audit: one entry per service that changed; terms are recorded in full (they are what customers accept)
    const describe = (s: IAdditionalService, i: number) =>
      `#${i + 1} ${s.name} · ${s.active ? 'active' : 'inactive'} · ${s.summary} · [${s.details.join(' | ')}] · icon ${s.icon}` +
      (s.termsText ? ` · terms v${s.termsVersion}` : ' · no terms');
    const before = new Map(previous.map((s, i) => [s.id, describe(s, i)]));
    const after = new Map(services.map((s, i) => [s.id, describe(s, i)]));
    const changes = Array.from(new Set([...Array.from(before.keys()), ...Array.from(after.keys())]))
      .filter(k => before.get(k) !== after.get(k))
      .map(k => ({ field: `service ${k}`, oldValue: before.get(k) ?? null, newValue: after.get(k) ?? null }));
    for (const s of services) {
      const prev = prevById.get(s.id);
      if ((prev?.termsText || '') !== s.termsText) {
        changes.push({ field: `terms ${s.id}`, oldValue: prev?.termsText || null, newValue: s.termsText || null });
      }
    }
    if (changes.length) {
      await audit(request, {
        module: 'SETTINGS', action: 'UPDATE', entityType: 'AdditionalServices', entityId: 'default',
        entityName: 'Additional services', changes,
        description: `Changed additional services (${changes.length} item${changes.length === 1 ? '' : 's'})`,
      });
    }

    return NextResponse.json({ success: true, data: { services } });
  } catch (error) {
    console.error('[Additional services] Save error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save services' }, { status: 500 });
  }
}
