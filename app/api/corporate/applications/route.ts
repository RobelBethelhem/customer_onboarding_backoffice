import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import CorporateApplication, { ICorporateApplication } from '@/lib/models/CorporateApplication';
import { requireRole } from '@/lib/apiAuth';
import { verificationCounts } from '@/lib/corporate';

export const dynamic = 'force-dynamic';

const STAFF = ['admin', 'kyc', 'senior_approver'] as const;
const STATUSES = ['awaiting_verification', 'pending', 'in_review', 'returned', 'escalated', 'approving', 'approved', 'rejected'];
const LIST_FIELDS = 'applicationId status organization.name organization.categoryName organization.subtypeName organization.tin '
  + 'branch branchCode accountTypeName accountClassName isIFB complianceHold submittedAt verifiedAt createdAt cifNumber accountNumber '
  + 'resubmissionCount people.fullName people.roles people.isApplicant people.verification.status people.verification.fullName';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /api/corporate/applications — business account applications (KYC officers, Senior
 * Approvers, admin). ?status=<status>|open|all &search= &limit= &skip=
 */
export async function GET(request: NextRequest) {
  const denied = requireRole(request, [...STAFF]);
  if (denied) return denied;
  try {
    await connectToDatabase();
    const sp = new URL(request.url).searchParams;
    const status = sp.get('status') || 'all';
    const search = (sp.get('search') || '').trim().slice(0, 100);
    const limit = Math.min(200, Math.max(1, parseInt(sp.get('limit') || '50', 10) || 50));
    const skip = Math.max(0, parseInt(sp.get('skip') || '0', 10) || 0);

    const query: Record<string, any> = {};
    if (status === 'open') query.status = { $in: ['pending', 'in_review'] };
    else if (STATUSES.includes(status)) query.status = status;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { 'organization.name': rx }, { applicationId: rx }, { cifNumber: rx }, { accountNumber: rx },
        { 'organization.tin': rx }, { 'organization.registrationNumber': rx }, { 'people.verification.fullName': rx },
      ];
    }

    const [items, total, grouped] = await Promise.all([
      CorporateApplication.find(query).select(LIST_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CorporateApplication.countDocuments(query),
      CorporateApplication.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const counts: Record<string, number> = { total: 0 };
    for (const s of STATUSES) counts[s] = 0;
    for (const g of grouped as { _id: string; count: number }[]) {
      counts[g._id] = g.count;
      counts.total += g.count;
    }

    return NextResponse.json({
      success: true,
      data: (items as unknown as ICorporateApplication[]).map(a => {
        const applicant = a.people.find(p => p.isApplicant);
        return {
          applicationId: a.applicationId,
          status: a.status,
          organizationName: a.organization.name,
          categoryName: a.organization.categoryName,
          subtypeName: a.organization.subtypeName,
          tin: a.organization.tin,
          branch: a.branch,
          branchCode: a.branchCode,
          accountTypeName: a.accountTypeName,
          accountClassName: a.accountClassName,
          isIFB: a.isIFB,
          complianceHold: a.complianceHold,
          applicantName: applicant?.verification?.fullName || applicant?.fullName || '',
          people: verificationCounts(a),
          submittedAt: a.submittedAt,
          verifiedAt: a.verifiedAt,
          cifNumber: a.cifNumber,
          accountNumber: a.accountNumber,
          resubmissionCount: a.resubmissionCount || 0,
        };
      }),
      total,
      counts,
    });
  } catch (error) {
    console.error('[Corporate] List error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load business account applications' }, { status: 500 });
  }
}
