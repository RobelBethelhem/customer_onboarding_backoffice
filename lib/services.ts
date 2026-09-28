// Additional services an applicant can ask for during onboarding. After the account is opened,
// a Personal Banker at the customer's branch sets them up and notifies the customer by SMS.

export const SERVICE_KEYS = ['mobile_banking', 'internet_banking', 'debit_card'] as const;
export type ServiceKey = typeof SERVICE_KEYS[number];

export const SERVICE_LABELS: Record<ServiceKey, string> = {
  mobile_banking: 'Mobile Banking',
  internet_banking: 'Internet Banking',
  debit_card: 'Debit Card',
};

/** Known service keys only, without duplicates, in a stable order */
export function normalizeServices(input: unknown): ServiceKey[] {
  const list: unknown[] = Array.isArray(input) ? input : [];
  return SERVICE_KEYS.filter(key => list.includes(key));
}

/** "Mobile Banking" / "Mobile Banking and Debit Card" / "Mobile Banking, Internet Banking and Debit Card" */
export function joinServiceLabels(services: string[]): string {
  const labels = services.map(s => SERVICE_LABELS[s as ServiceKey] || s);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** Added to the "account created" SMS when the customer asked for services */
export function servicesInProgressSmsLine(services: string[]): string {
  if (!services.length) return '';
  return `Your request for ${joinServiceLabels(services)} is being processed. We will notify you shortly once it is ready.`;
}

/** SMS the Personal Banker sends once the services are set up */
export function servicesReadySms(
  fullName: string,
  accountNumber: string | undefined,
  services: string[],
  customMessage?: string
): string {
  const plural = services.length > 1;
  const account = accountNumber ? ` on your Zemen Bank account ${accountNumber}` : '';
  const extra = customMessage?.trim() ? `\n\n${customMessage.trim()}` : '';
  return `Dear ${fullName},\n\nYour ${joinServiceLabels(services)} ${plural ? 'are' : 'is'} now ready${account}. ` +
    `You can start using ${plural ? 'them' : 'it'}.${extra}\n\nThank you for banking with Zemen Bank!`;
}
