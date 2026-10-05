import AccountProductSettings, { IAccountClass, IAccountProduct } from '@/lib/models/AccountProducts';
import { DEFAULT_ACCOUNT_PRODUCTS } from '@/lib/accountProductDefaults';

export const defaultAccountProducts = (): IAccountProduct[] =>
  DEFAULT_ACCOUNT_PRODUCTS.map(p => ({ ...p, classes: p.classes.map(c => ({ ...c })) }));

/** The account product catalog (Account Products page), seeded with the defaults on first use */
export async function getAccountProducts(): Promise<IAccountProduct[]> {
  const doc = await AccountProductSettings.findOneAndUpdate(
    { _id: 'default' },
    { $setOnInsert: { products: defaultAccountProducts(), updatedBy: 'system (default catalog)' } },
    { upsert: true, new: true }
  ).lean() as any;
  return doc?.products || [];
}

/**
 * The product and class an application refers to: accountTypeId = product id, tierName = class code
 * (as the web app sends them). Null for applications from older apps that used other ids.
 */
export async function findAccountClass(
  productId: string, classCode: string
): Promise<{ product: IAccountProduct; accountClass: IAccountClass } | null> {
  if (!productId || !classCode) return null;
  const product = (await getAccountProducts()).find(p => p.id === productId);
  const accountClass = product?.classes.find(c => c.code.toUpperCase() === classCode.toUpperCase());
  return product && accountClass ? { product, accountClass } : null;
}
