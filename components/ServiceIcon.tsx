'use client';

import { Smartphone, Globe, CreditCard, Wallet, MessageSquare, Bell, Send, ShieldCheck, PiggyBank, Star } from 'lucide-react';
import { serviceIconKey } from '@/lib/serviceIcons';

export const SERVICE_ICON_COMPONENTS: Record<string, React.ElementType> = {
  smartphone: Smartphone, globe: Globe, card: CreditCard, wallet: Wallet, message: MessageSquare,
  bell: Bell, send: Send, shield: ShieldCheck, piggy: PiggyBank, star: Star,
};

/** Icon of an additional service (its catalog icon, or the original one for older applications) */
export default function ServiceIcon({ id, icon, className }: { id: string; icon?: string; className?: string }) {
  const Icon = SERVICE_ICON_COMPONENTS[serviceIconKey(id, icon)] || Star;
  return <Icon className={className} />;
}
