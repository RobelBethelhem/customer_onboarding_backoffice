// Icons KYC can pick for an additional service. The web app maps the same keys to its own icons.
export const SERVICE_ICON_KEYS = [
  'smartphone', 'globe', 'card', 'wallet', 'message', 'bell', 'send', 'shield', 'piggy', 'star',
] as const;

export const SERVICE_ICON_LABELS: Record<string, string> = {
  smartphone: 'Phone', globe: 'Internet', card: 'Card', wallet: 'Wallet', message: 'SMS',
  bell: 'Alerts', send: 'Transfer', shield: 'Protection', piggy: 'Savings', star: 'Other',
};

/** Icon for a service: its own, or the one the original services used */
export function serviceIconKey(id: string, icon?: string): string {
  if (icon && (SERVICE_ICON_KEYS as readonly string[]).includes(icon)) return icon;
  return ({ mobile_banking: 'smartphone', internet_banking: 'globe', debit_card: 'card' } as Record<string, string>)[id] || 'star';
}
