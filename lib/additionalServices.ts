import AdditionalServiceSettings, { IAdditionalService } from '@/lib/models/AdditionalServices';
import { DEFAULT_ADDITIONAL_SERVICES } from '@/lib/additionalServiceDefaults';

export const defaultAdditionalServices = (): IAdditionalService[] =>
  DEFAULT_ADDITIONAL_SERVICES.map(s => ({ ...s, details: [...s.details] }));

/** The additional services catalog (Products & Services page), seeded with the defaults on first use */
export async function getAdditionalServices(): Promise<IAdditionalService[]> {
  const doc = await AdditionalServiceSettings.findOneAndUpdate(
    { _id: 'default' },
    { $setOnInsert: { services: defaultAdditionalServices(), updatedBy: 'system (default catalog)' } },
    { upsert: true, new: true }
  ).lean() as any;
  return doc?.services || [];
}
