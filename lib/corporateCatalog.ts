import CorporateCatalogSettings, {
  ICorporateCategory, ICorporateDocumentType, ICorporateRules,
} from '@/lib/models/CorporateCatalog';
import { DEFAULT_CORPORATE_CATEGORIES, DEFAULT_CORPORATE_RULES } from '@/lib/corporateCatalogDefaults';

export const defaultCorporateCategories = (): ICorporateCategory[] =>
  JSON.parse(JSON.stringify(DEFAULT_CORPORATE_CATEGORIES));

/** Organization categories and rules (Products & Services page), seeded on first use */
export async function getCorporateCatalog(): Promise<{ categories: ICorporateCategory[]; rules: ICorporateRules }> {
  const doc = await CorporateCatalogSettings.findOneAndUpdate(
    { _id: 'default' },
    {
      $setOnInsert: {
        categories: defaultCorporateCategories(),
        rules: { ...DEFAULT_CORPORATE_RULES },
        updatedBy: 'system (KYC procedure, September 2023)',
      },
    },
    { upsert: true, new: true }
  ).lean() as any;
  return {
    categories: doc?.categories || [],
    rules: { ...DEFAULT_CORPORATE_RULES, ...(doc?.rules || {}) },
  };
}

/** The active documents an organization of this category and sub-type uploads */
export function documentsFor(category: ICorporateCategory, subtypeId: string): ICorporateDocumentType[] {
  return category.documents.filter(d => d.active && (!d.subtypes.length || d.subtypes.includes(subtypeId)));
}
