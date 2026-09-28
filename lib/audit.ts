import AuditLog, { IFieldChange } from '@/lib/models/AuditLog';
import type { AuditAction, AuditModule, AuditStatus } from '@/lib/auditTypes';
import { clientIp } from '@/lib/clientIp';

export interface AuditActor {
  performedBy: string;       // display name (or email / 'SYSTEM' / 'Applicant')
  performedById?: string;
  performedByName?: string;
  performedByEmail?: string;
  performedByRole?: string;
}

export interface AuditEvent {
  module: AuditModule;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityName?: string;
  description: string;
  status?: AuditStatus;       // default SUCCESS
  changes?: IFieldChange[];
  actor?: AuditActor;         // default: the signed-in dashboard user making the request
}

export const SYSTEM_ACTOR: AuditActor = { performedBy: 'SYSTEM', performedByRole: 'system' };

/** The signed-in dashboard user behind this request (headers set by middleware.ts) */
export function requestActor(request: Request): AuditActor {
  const name = request.headers.get('x-user-name') || '';
  const email = request.headers.get('x-user-email') || '';
  return {
    performedBy: name || email || 'Unknown',
    performedById: request.headers.get('x-user-id') || '',
    performedByName: name,
    performedByEmail: email,
    performedByRole: request.headers.get('x-user-role') || '',
  };
}

/** A dashboard user as actor — for sign-in events, which happen before there is a session */
export function userActor(user: { _id: any; name?: string; email?: string; role?: string }): AuditActor {
  return {
    performedBy: user.name || user.email || String(user._id),
    performedById: String(user._id),
    performedByName: user.name || '',
    performedByEmail: user.email || '',
    performedByRole: user.role || '',
  };
}

/** Keep change values small: long strings (photos, documents) are summarised, not copied */
export function shorten(value: unknown): unknown {
  if (typeof value === 'string' && value.length > 200) return `${value.slice(0, 80)}… (${value.length} characters)`;
  return value;
}

/** Field-level changes between two snapshots, limited to the given fields */
export function fieldChanges(before: Record<string, any>, after: Record<string, any>, fields: string[]): IFieldChange[] {
  return fields
    .filter(f => JSON.stringify(before?.[f] ?? null) !== JSON.stringify(after?.[f] ?? null))
    .map(f => ({ field: f, oldValue: shorten(before?.[f] ?? null), newValue: shorten(after?.[f] ?? null) }));
}

/** Actor fields plus IP / user agent, for code that writes AuditLog documents directly */
export function auditContext(request: Request) {
  return {
    ...requestActor(request),
    ipAddress: clientIp(request),
    userAgent: (request.headers.get('user-agent') || '').slice(0, 300),
  };
}

export function newAuditId(): string {
  return `AUD-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`.toUpperCase();
}

/** Record an audit event. Never throws: a failed audit write must not undo the action itself. */
export async function audit(request: Request | null, event: AuditEvent): Promise<void> {
  try {
    const actor = event.actor || (request ? requestActor(request) : SYSTEM_ACTOR);
    await AuditLog.create({
      auditId: newAuditId(),
      ...actor,
      module: event.module,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId || '-',
      entityName: event.entityName,
      description: event.description,
      status: event.status || 'SUCCESS',
      changes: event.changes,
      ipAddress: request ? clientIp(request) : undefined,
      userAgent: request ? (request.headers.get('user-agent') || '').slice(0, 300) : undefined,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error(`[Audit] Could not record ${event.module}/${event.action}:`, error);
  }
}
