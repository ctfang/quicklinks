import type { NavLink } from '../services/api';

export type CardLayout = 'mixed' | 'configured' | 'icons';
export type CardSize = NonNullable<NavLink['displaySize']>;

const mixedSizes: CardSize[] = ['large', 'medium', 'small', 'small', 'small', 'small', 'small', 'small', 'small', 'small'];
const validSizes: CardSize[] = ['icon', 'small', 'medium', 'large', 'list'];

export function navigationCardSize(displaySize: NavLink['displaySize'], index: number, layout: CardLayout): CardSize {
  if (layout === 'icons' || displaySize === 'icon') return 'icon';
  if (layout === 'mixed') return mixedSizes[index % mixedSizes.length];
  return validSizes.includes(displaySize as CardSize) ? displaySize as CardSize : 'medium';
}
