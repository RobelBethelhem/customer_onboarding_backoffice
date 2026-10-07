import type { ICorporateCategory, ICorporateDocumentType, ICorporateRules } from '@/lib/models/CorporateCatalog';

// Organization categories and their documents, from the KYC Procedure (September 2023) 2.3.2–2.3.6
// and 3.4. The signatories' IDs are not uploads: every signatory and director verifies with
// Fayda (SMS link). KYC officers change all of this on the Products & Services page.

const doc = (id: string, name: string, description = '', required = true, subtypes: string[] = []): ICorporateDocumentType =>
  ({ id, name, description, required, subtypes, active: true });
const sub = (id: string, name: string) => ({ id, name, active: true });

export const DEFAULT_CORPORATE_RULES: ICorporateRules = {
  maxPeople: 10,
  maxFileMb: 5,
  signatureRequired: true,
  inviteValidDays: 14,
};

export const DEFAULT_CORPORATE_CATEGORIES: ICorporateCategory[] = [
  {
    id: 'business', name: 'Business Organization', active: true,
    description: 'Sole proprietorships, private limited companies, share companies and other businesses.',
    subtypes: [
      sub('sole_proprietorship', 'Sole proprietorship'),
      sub('plc', 'Private limited company (PLC)'),
      sub('share_company', 'Share company (SC)'),
      sub('other_business', 'Other business organization'),
    ],
    documents: [
      doc('application_letter', 'Application letter', 'Letter applying to open the account, naming the signatories appointed to operate it.'),
      doc('registration_certificate', 'Registration license / certificate', 'From the concerned government body.'),
      doc('trade_license', 'Trade license', 'Renewed, from the government body authorized to issue it.'),
      doc('moa_aoa', 'Memorandum and Articles of Association', 'For private limited companies and share companies.', true, ['plc', 'share_company']),
      doc('tin_certificate', 'TIN certificate', 'Taxpayer registration certificate.', false),
      doc('vat_certificate', 'VAT registration certificate', 'If registered for VAT.', false),
      doc('investment_license', 'Investment license', 'If the business holds one.', false),
    ],
  },
  {
    id: 'public_enterprise', name: 'Public Enterprise', active: true,
    description: 'Government-owned enterprises established by proclamation.',
    subtypes: [],
    documents: [
      doc('board_letter', 'Letter from the Board of Directors or General Manager', 'Formal letter naming, among other things, the authorized signatories.'),
      doc('appointment_letter', 'Letter of appointment', 'From the General Manager.'),
      doc('negarit_gazette', 'Negarit Gazette', 'Bearing the proclamation establishing the enterprise.'),
    ],
  },
  {
    id: 'ngo', name: 'NGO (Local or International)', active: true,
    description: 'Charities and non-governmental organizations.',
    subtypes: [sub('local', 'Local NGO'), sub('international', 'International NGO')],
    documents: [
      doc('application_letter', 'Application letter', 'Letter applying to open the account.'),
      doc('license', 'License', 'From the concerned government body.'),
      doc('signatory_authorization', 'Authorization of signatories', 'From the Charities and Societies Agency.'),
      doc('constitution', 'Constitution / Charter', 'Of the organization.'),
      doc('operators_list', 'Persons authorized to operate the account', 'As specified in the Constitution/Charter or another document.'),
      doc('work_permit', 'Work or residence permit', 'For foreign national signatories.', false),
    ],
  },
  {
    id: 'religious', name: 'Religious Organization', active: true,
    description: 'Churches, mosques and other religious institutions.',
    subtypes: [
      sub('orthodox', 'Ethiopian Orthodox Church'),
      sub('catholic', 'Catholic Church'),
      sub('islamic', 'Islamic organization'),
      sub('eecmy', 'Ethiopian Evangelical Church Mekane Yesus'),
      sub('other_religion', 'Other religious denomination'),
    ],
    documents: [
      doc('application_letter', 'Application letter', 'Letter applying to open the account.'),
      doc('support_patriarch', 'Letter of support from the Patriarch', 'Or his designate.', true, ['orthodox']),
      doc('support_cardinal', 'Letter of support from the Cardinal', 'Or his designate.', true, ['catholic']),
      doc('support_islamic_council', 'Letter of support from the Islamic Council', 'From the Islamic Council office.', true, ['islamic']),
      doc('support_eecmy', 'Letter of support from the President', 'Of the Ethiopian Evangelical Church Mekane Yesus, or his designate.', true, ['eecmy']),
      doc('support_federal_affairs', 'Letter of support from the concerned government body', 'Currently the Ministry of Federal Affairs.', true, ['other_religion']),
    ],
  },
  {
    id: 'cooperative', name: 'Cooperative, Association or Edir', active: true,
    description: 'Cooperatives, associations and Edirs.',
    subtypes: [sub('cooperative', 'Cooperative'), sub('association', 'Association'), sub('edir', 'Edir')],
    documents: [
      doc('registration_certificate', 'Certificate of registration', 'Or letter of support from the appropriate government body certifying the establishment.'),
      doc('moa_aoa', 'Memorandum and Articles of Association', 'Duly registered, where applicable.', false),
      doc('rules_regulations', 'Rules and regulations', 'Approved and registered, bearing the stamps of the registering body and the cooperative.', true, ['cooperative']),
      doc('empowerment_letter', 'Letter naming the persons who operate the account', 'As per the memorandum and articles of association.'),
    ],
  },
];
