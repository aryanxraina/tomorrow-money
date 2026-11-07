import { ArrowLeftRight, Baby, Banknote, Bus, CircleDashed, CreditCard, Droplet, FileText, GraduationCap, Home, Landmark, PiggyBank, Receipt, Repeat, Shield, ShoppingBag, ShoppingBasket, Undo2, Users, UtensilsCrossed, Wallet, Wifi, Zap, type LucideIcon } from 'lucide-react';
import type { Category } from '@/lib/types';

const ICONS: Record<Category, LucideIcon> = {
  income: Wallet,
  housing: Home,
  council_tax: Landmark,
  energy: Zap,
  water: Droplet,
  broadband_phone: Wifi,
  groceries: ShoppingBasket,
  transport: Bus,
  insurance: Shield,
  debt: CreditCard,
  fees: Receipt,
  subscriptions: Repeat,
  eating_out: UtensilsCrossed,
  shopping: ShoppingBag,
  kids: Baby,
  cash: Banknote,
  transfers: Users,
  internal: ArrowLeftRight,
  refund: Undo2,
  education: GraduationCap,
  tax: FileText,
  savings: PiggyBank,
  other: CircleDashed,
};

export function CategoryIcon({ category, size = 20 }: { category?: Category; size?: number }) {
  const Icon = ICONS[category ?? 'other'];
  return <Icon size={size} aria-hidden />;
}
