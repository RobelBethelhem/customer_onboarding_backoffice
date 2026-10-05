import type { IAdditionalService } from '@/lib/models/AdditionalServices';

// The services the web app offered before the catalog existed (same ids, so older applications
// still match). KYC can change, reorder, switch off or add to these on the Products & Services page.
const service = (id: string, name: string, icon: string, summary: string, details: string[]): IAdditionalService => ({
  id, name, icon, summary, details,
  termsTitle: '', termsText: '', termsVersion: 0, termsUpdatedAt: null,
  active: true,
});

export const DEFAULT_ADDITIONAL_SERVICES: IAdditionalService[] = [
  service('mobile_banking', 'Mobile Banking', 'smartphone', 'Bank from your phone with the Zemen Bank mobile app.', [
    'Check your balance and recent transactions anytime',
    'Send money to Zemen Bank and other bank accounts',
    'Pay bills, buy airtime and pay merchants from your phone',
  ]),
  service('internet_banking', 'Internet Banking', 'globe', 'Manage your account online from a computer or laptop.', [
    'View your balance and download account statements',
    'Transfer money and pay bills from your web browser',
    'Handy for larger or more detailed transactions',
  ]),
  service('debit_card', 'Debit Card', 'card', 'A card linked to your account for cash and payments.', [
    'Withdraw cash at ATMs',
    'Pay at shops and merchants that accept cards',
    'We will send you an SMS when your card is ready',
  ]),
];
