import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import AuditLog from '@/lib/models/AuditLog';
import { requireRole } from '@/lib/apiAuth';
import { audit } from '@/lib/audit';
import { AUDIT_ACTIONS, AUDIT_MODULES, AUDIT_STATUSES } from '@/lib/auditTypes';

export const dynamic = 'force-dynamic';

const CSV_LIMIT = 10_000;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Mongo filter from the page's query string (every value validated or escaped) */
function buildQuery(params: URLSearchParams) {
  const query: Record<string, any> = {};
  const and: Record<string, any>[] = [];

  const module = params.get('module') || '';
  if ((AUDIT_MODULES as readonly string[]).includes(module)) query.module = module;
  const action = params.get('action') || '';
  if ((AUDIT_ACTIONS as readonly string[]).includes(action)) query.action = action;
  const status = params.get('status') || '';
  if (status === 'SUCCESS') query.status = { $in: ['SUCCESS', null] }; // older entries have no status
  else if ((AUDIT_STATUSES as readonly string[]).includes(status)) query.status = status;
  const role = params.get('role') || '';
  if (role) query.performedByRole = { $eq: role };

  const user = (params.get('user') || '').trim();
  if (user) {
    const re = new RegExp(escapeRegex(user), 'i');
    and.push({ $or: [{ performedBy: re }, { performedByName: re }, { performedByEmail: re }] });
  }
  const entity = (params.get('entity') || '').trim();
  if (entity) {
    const re = new RegExp(escapeRegex(entity), 'i');
    and.push({ $or: [{ entityId: re }, { entityName: re }] });
  }

  const from = new Date(params.get('from') || '');
  const to = new Date(params.get('to') || '');
  if (!isNaN(from.getTime()) || !isNaN(to.getTime())) {
    query.timestamp = {};
    if (!isNaN(from.getTime())) query.timestamp.$gte = from;
    if (!isNaN(to.getTime())) query.timestamp.$lte = to;
  }

  if (and.length) query.$and = and;
  return query;
}

// CSV cell: quoted, and neutralised if it could run as a spreadsheet formula
function csvCell(value: unknown): string {
  let text = value === undefined || value === null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * GET /api/audit-logs — admin only.
 * ?page&limit&module&action&role&status&user&entity&from&to  (from/to: ISO date-times)
 * ?format=csv downloads the filtered log (newest first, up to 10,000 rows).
 */
export async function GET(request: NextRequest) {
  const denied = requireRole(request, ['admin']);
  if (denied) return denied;

  try {
    await connectToDatabase();
    const params = request.nextUrl.searchParams;
    const query = buildQuery(params);

    if (params.get('format') === 'csv') {
      const rows = await AuditLog.find(query).sort({ timestamp: -1 }).limit(CSV_LIMIT).lean() as any[];
      const header = ['Time', 'User', 'Email', 'Role', 'Module', 'Action', 'Outcome', 'Target Type', 'Target ID',
        'Target Name', 'Details', 'Changes', 'IP Address', 'User Agent', 'Audit ID'];
      const lines = rows.map(r => [
        new Date(r.timestamp).toISOString(), r.performedByName || r.performedBy, r.performedByEmail, r.performedByRole,
        r.module, r.action, r.status || 'SUCCESS', r.entityType, r.entityId, r.entityName, r.description,
        (r.changes || []).map((c: any) => `${c.field}: ${JSON.stringify(c.oldValue)} -> ${JSON.stringify(c.newValue)}`).join('; '),
        r.ipAddress, r.userAgent, r.auditId,
      ].map(csvCell).join(','));

      await audit(request, {
        module: 'AUDIT', action: 'EXPORT', entityType: 'AuditLog', entityId: '-',
        description: `Exported ${rows.length} audit log entries (${params.toString().replace(/&?format=csv/, '') || 'no filters'})`,
      });

      const date = new Date().toISOString().slice(0, 10);
      return new NextResponse('﻿' + [header.map(csvCell).join(','), ...lines].join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-log-${date}.csv"`,
        },
      });
    }

    const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(params.get('limit') || '50', 10) || 50));

    const [total, logs, facets] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.aggregate([
        { $match: query },
        {
          $facet: {
            byAction: [{ $group: { _id: '$action', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
            byRole: [{ $group: { _id: '$performedByRole', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
            byStatus: [{ $group: { _id: { $ifNull: ['$status', 'SUCCESS'] }, count: { $sum: 1 } } }],
          },
        },
      ]),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      summary: facets[0],
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error('[Audit] List error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load the audit log' }, { status: 500 });
  }
}
