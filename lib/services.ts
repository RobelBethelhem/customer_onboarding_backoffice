// Additional services an applicant can ask for during onboarding (managed by KYC on the Products &
// Services page). After the account is opened, a Personal Banker at the customer's branch sets
// them up and notifies the customer by SMS.

/** Names of the services offered before the catalog existed — used for applications from that time */
export const LEGACY_SERVICE_NAMES: Record<string, string> = {
  mobile_banking: 'Mobile Banking',
  internet_banking: 'Internet Banking',
  debit_card: 'Debit Card',
};

export type ServiceNames = Record<string, string>;

/** A requested service as saved with the application: its name and terms acceptance at that time */
export interface RequestedServiceDetail {
  id: string;
  name: string;
  icon?: string;
  termsRequired?: boolean;
  termsTitle?: string;
  termsVersion?: number;          // version in force when the application was submitted
  termsAcceptedVersion?: number;  // version the applicant accepted (0 = not accepted)
  termsAcceptedAt?: string | Date;
}

/** Service names for an application: as saved with it, else the names used before the catalog */
export function serviceNamesFor(c: { requestedServiceDetails?: RequestedServiceDetail[] }): ServiceNames {
  const names: ServiceNames = { ...LEGACY_SERVICE_NAMES };
  for (const d of c.requestedServiceDetails || []) {
    if (d?.id && d.name) names[d.id] = d.name;
  }
  return names;
}

/** The requested ids that are in `allowed`, without duplicates, in the order of `allowed` */
export function normalizeServices(input: unknown, allowed: string[]): string[] {
  const list: unknown[] = Array.isArray(input) ? input : [];
  return allowed.filter(id => list.includes(id));
}

/** "Mobile Banking" / "Mobile Banking and Debit Card" / "Mobile Banking, Internet Banking and Debit Card" */
export function joinServiceLabels(services: string[], names: ServiceNames = LEGACY_SERVICE_NAMES): string {
  const labels = services.map(s => names[s] || s);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** Added to the "account created" SMS when the customer asked for services */
export function servicesInProgressSmsLine(services: string[], names?: ServiceNames): string {
  if (!services.length) return '';
  return `Your request for ${joinServiceLabels(services, names)} is being processed. We will notify you shortly once it is ready.`;
}

/** SMS the Personal Banker sends once the services are set up */
export function servicesReadySms(
  fullName: string,
  accountNumber: string | undefined,
  services: string[],
  customMessage?: string,
  names?: ServiceNames
): string {
  const plural = services.length > 1;
  const account = accountNumber ? ` on your Zemen Bank account ${accountNumber}` : '';
  const extra = customMessage?.trim() ? `\n\n${customMessage.trim()}` : '';
  return `Dear ${fullName},\n\nYour ${joinServiceLabels(services, names)} ${plural ? 'are' : 'is'} now ready${account}. ` +
    `You can start using ${plural ? 'them' : 'it'}.${extra}\n\nThank you for banking with Zemen Bank!`;
}
