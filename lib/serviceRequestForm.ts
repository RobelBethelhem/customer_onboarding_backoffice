// The Additional Services Request form: what the Personal Banker sees on the request page, prints
// and downloads as PDF (lib/serviceRequestPdf.ts) — one list of fields so the three always match.
// Kept free of mongoose so the page can import it.

import { serviceNamesFor, RequestedServiceDetail } from '@/lib/services';
import { currencyName } from '@/lib/currencies';

export interface ServiceRequestCustomer {
  customerId: string;
  fullName: string;
  fullNameAmharic?: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  nationality?: string;
  idType?: string;
  fcn?: string;
  region?: string;
  zone?: string;
  woreda?: string;
  kebele?: string;
  houseNumber?: string;
  branch?: string;
  branchCode?: string;
  accountNumber?: string;
  cifNumber?: string;
  customerNumber?: string;
  existingCif?: string;
  isExistingCustomer?: boolean;
  accountType?: string;
  accountTypeName?: string;
  accountClassCode?: string;
  accountClassName?: string;
  tierName?: string;
  currency?: string;
  approvedAt?: string | Date;
  requestedServices?: string[];
  requestedServiceDetails?: RequestedServiceDetail[];
  servicesStatus?: string;
  completedServices?: { service: string; completedAt: string | Date; completedBy: string }[];
  serviceNotifications?: { services: string[]; smsSent: boolean; sentAt: string | Date; sentBy: string }[];
}

export interface FormRow { label: string; value: string }
export interface FormSection { title: string; rows: FormRow[] }
export interface FormService { name: string; terms: string; termsMissing: boolean; status: string; done: boolean }

/** "21 Oct 2026, 14:35" in Addis Ababa time, the same in the browser and on the server */
export function formatFormDate(value: string | Date | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Addis_Ababa', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

const has = (v: unknown) => typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/**
 * The details on the form. Full name, phone and email always; the others only when the customer has
 * them. `amharic: false` leaves out the Amharic name (the PDF fonts have no Ethiopic script).
 */
export function serviceRequestSections(c: ServiceRequestCustomer, { amharic = true } = {}): FormSection[] {
  const rows = (list: [string, unknown][]): FormRow[] =>
    list.filter(([, v]) => has(v)).map(([label, v]) => ({ label, value: String(v).trim() }));

  const customer: FormRow[] = [
    { label: 'Full name', value: c.fullName || '-' },
    ...rows([['Full name (Amharic)', amharic ? c.fullNameAmharic : '']]),
    { label: 'Phone', value: c.phone || '-' },
    { label: 'Email', value: c.email?.trim() || 'Not provided' },
    ...rows([
      ['Gender', c.gender ? capitalize(c.gender) : ''],
      ['Date of birth', c.dateOfBirth],
      ['Nationality', c.nationality],
      [c.idType ? `${c.idType} number` : 'Fayda number', c.fcn],
    ]),
  ];
  const address = rows([
    ['Region', c.region],
    ['Zone / Sub-city', c.zone],
    ['Woreda', c.woreda],
    ['Kebele', c.kebele],
    ['House number', c.houseNumber],
  ]);
  const currency = c.currency || 'ETB';
  const accountClass = c.accountClassCode
    ? `${c.accountClassName || c.tierName || c.accountClassCode} (${c.accountClassCode})`
    : c.tierName;
  const account = rows([
    ['Account number', c.accountNumber],
    ['CIF number', c.cifNumber || c.customerNumber || c.existingCif],
    ['Account type', c.accountTypeName || c.accountType],
    ['Account class', accountClass],
    ['Currency', `${currency} — ${currencyName(currency)}`],
    ['Branch', c.branch ? `${c.branch}${c.branchCode ? ` (${c.branchCode})` : ''}` : c.branchCode],
    ['Account opened', c.approvedAt ? formatFormDate(c.approvedAt) : ''],
    ['Customer', c.isExistingCustomer ? 'Existing customer — new account under the same CIF' : ''],
    ['Application ID', c.customerId],
  ]);

  return [
    { title: 'Customer', rows: customer },
    { title: 'Address', rows: address },
    { title: 'Account', rows: account },
  ].filter(s => s.rows.length > 0);
}

/** The requested services: terms acceptance and whether the Personal Banker has set each one up */
export function serviceRequestServices(c: ServiceRequestCustomer): FormService[] {
  const names = serviceNamesFor(c);
  return (c.requestedServices || []).map(id => {
    const detail = (c.requestedServiceDetails || []).find(d => d.id === id);
    const done = (c.completedServices || []).find(s => s.service === id);
    let terms = 'No terms to accept';
    let termsMissing = false;
    if (detail?.termsRequired) {
      if (detail.termsAcceptedVersion) {
        terms = `Accepted online (version ${detail.termsAcceptedVersion}${detail.termsAcceptedAt ? `, ${formatFormDate(detail.termsAcceptedAt)}` : ''})`;
      } else {
        terms = 'Not accepted online — customer to sign at the branch';
        termsMissing = true;
      }
    }
    return {
      name: names[id] || id,
      terms,
      termsMissing,
      status: done ? `Set up ${formatFormDate(done.completedAt)}${done.completedBy ? ` by ${done.completedBy}` : ''}` : 'Waiting to be set up',
      done: !!done,
    };
  });
}

/** SMS sent to the customer about the services: "21 Oct 2026, 14:35 · Abebe K. · Mobile Banking · SMS delivered" */
export function serviceRequestNotifications(c: ServiceRequestCustomer): string[] {
  const names = serviceNamesFor(c);
  return (c.serviceNotifications || []).map(n => [
    formatFormDate(n.sentAt),
    n.sentBy,
    (n.services || []).map(s => names[s] || s).join(', '),
    n.smsSent ? 'SMS delivered' : 'SMS not delivered',
  ].filter(Boolean).join(' · '));
}

export const serviceRequestStatus = (c: ServiceRequestCustomer) =>
  c.servicesStatus === 'completed' ? 'Completed' : 'Waiting to be set up';
