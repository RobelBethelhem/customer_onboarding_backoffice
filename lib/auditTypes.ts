// Audit log vocabulary — shared by the AuditLog model, the API and the Audit Log page
// (kept free of mongoose so client components can import it).

export const AUDIT_MODULES = [
  'AUTH', 'APPLICATION', 'CUSTOMER', 'SERVICES', 'USER', 'SETTINGS', 'REFERRAL',
  'SANCTIONS', 'PEP', 'SCREENING', 'AUDIT', 'SYSTEM',
] as const;
export type AuditModule = typeof AUDIT_MODULES[number];

export const AUDIT_ACTIONS = [
  // Sign-in
  'LOGIN', 'LOGIN_OTP_SENT', 'LOGIN_FAILED', 'OTP_FAILED', 'ACCOUNT_LOCKED', 'LOGOUT',
  // Applications and KYC decisions
  'SUBMIT', 'AUTO_APPROVE', 'VIEW', 'REVIEW', 'APPROVE', 'APPROVE_FAILED', 'REJECT', 'RETURN', 'ESCALATE',
  'ACCESS_DENIED',
  // Records
  'CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'IMPORT', 'EXPORT', 'STATUS_CHANGE', 'BULK_UPDATE', 'BULK_DELETE',
  // User management
  'ACTIVATE', 'DEACTIVATE', 'LOCK', 'UNLOCK', 'PASSWORD_RESET',
  // Personal Banker
  'SERVICES_COMPLETED',
  // Screening
  'SCREENING_CHECK', 'SCREENING_MATCH', 'SCREENING_CLEAR',
] as const;
export type AuditAction = typeof AUDIT_ACTIONS[number];

export const AUDIT_STATUSES = ['SUCCESS', 'FAILURE', 'DENIED'] as const;
export type AuditStatus = typeof AUDIT_STATUSES[number];

// Who can appear as the actor: dashboard roles plus applicants and the system itself
export const AUDIT_ROLES = [
  'admin', 'kyc', 'senior_approver', 'branch', 'personal_banker', 'marketing', 'sanction_uploader',
  'applicant', 'system',
] as const;
