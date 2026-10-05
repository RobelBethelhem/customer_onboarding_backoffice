import type { IAccountProduct } from '@/lib/models/AccountProducts';

// Digital account catalog from the business (Product Type → Digital Account Class, proposed code,
// remarks). Seeded the first time the catalog is read; after that KYC officers maintain it on the
// Account Products page. productNumber keeps the number the web app used to send for the same class
// (blank where there was none — the account template then falls back to 111 as before).
const cls = (
  code: string, name: string, interestRate: number | null, minBalance: number | null,
  maxBalance: number | null, remarks: string, productNumber: string
) => ({ code, name, interestRate, minBalance, maxBalance, remarks, productNumber, active: true });

export const DEFAULT_ACCOUNT_PRODUCTS: IAccountProduct[] = [
  {
    id: 'digital-account', name: 'Digital Account Product', isIFB: false, active: true,
    description: 'Everyday account operated through digital banking channels.',
    classes: [
      cls('ZDAC', 'Z-Digital Account', 7, 5000, null, 'Interest rate 7%, minimum balance 5,000.00', '26'),
    ],
  },
  {
    id: 'saving-account', name: 'Saving Account', isIFB: false, active: true,
    description: 'Digital saving accounts — the interest rate depends on the class and balance.',
    classes: [
      cls('DBSV', 'Basic Saving — Digital', 7, 5000, null, 'Interest rate 7%, minimum balance 5,000.00', '27'),
      cls('DPSV', 'Personal Saving — Digital', 7, 100000, null, 'Interest rate 7%, minimum balance 100,000.00', '38'),
      cls('DPRS', 'Z-Club Saving — Digital', 7.5, 500000, null, 'Interest rate 7.5%, minimum balance 500,000.00', ''),
      cls('DZSB', 'Z-Club Special Basic Saving — Digital', 7.75, 500000, 2000000, 'Interest rate 7.75%, balance 500,000.00 to 2,000,000.00', '37'),
      cls('DZSG', 'Z-Club Special Gold Saving — Digital', 7, 2000000, 5000000, 'Interest rate 7%, balance 2,000,000.00 to 5,000,000.00', '36'),
      cls('DZSP', 'Z-Club Special Platinum Saving — Digital', 7, 5000000, null, 'Interest rate 7%, balance greater than 5,000,000.00', '28'),
      cls('DFCY', 'Foreign Currency Saving Account', null, null, null, 'Same as FCY Saving Account', '29'),
    ],
  },
  {
    id: 'digital-ifb-account', name: 'Digital IFB Account Product', isIFB: true, active: true,
    description: 'Interest-free (Z-Qamar) digital account.',
    classes: [
      cls('ZDIF', 'Z-Digital IFB Account', null, 5000, null, 'No interest; minimum balance 5,000.00', '971'),
    ],
  },
  {
    id: 'ifb-saving-account', name: 'IFB Saving Account', isIFB: true, active: true,
    description: 'Interest-free (Z-Qamar) Wadia saving account.',
    classes: [
      cls('DWAD', 'IFB Saving Account (WADIA) — Digital', null, 5000, null, 'No interest; minimum balance 5,000.00', '971'),
    ],
  },
];
