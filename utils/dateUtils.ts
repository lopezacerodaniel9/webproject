import { ExpiryStatus, PantryItem, PantryItemWithStatus } from '@/types/pantry';

/**
 * Calcula los días que faltan hasta la fecha de caducidad.
 * Puede ser negativo si ya ha caducado.
 */
export function getDaysUntilExpiry(expirationDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expirationDate);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determina el estado de caducidad basado en los días restantes.
 */
export function getExpiryStatus(daysUntilExpiry: number): ExpiryStatus {
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 3) return 'critical';
  if (daysUntilExpiry <= 7) return 'warning';
  return 'safe';
}

/**
 * Devuelve las clases de color Tailwind según el estado.
 */
export function getExpiryColorClasses(status: ExpiryStatus): {
  badge: string;
  border: string;
  text: string;
  bg: string;
  glow: string;
} {
  switch (status) {
    case 'expired':
      return {
        badge: 'bg-zinc-800 text-zinc-400 border-zinc-700',
        border: 'border-zinc-700',
        text: 'text-zinc-400',
        bg: 'bg-zinc-900/40',
        glow: '',
      };
    case 'critical':
      return {
        badge: 'bg-red-500/20 text-red-400 border-red-500/40',
        border: 'border-red-500/40',
        text: 'text-red-400',
        bg: 'bg-red-950/20',
        glow: 'shadow-red-900/30',
      };
    case 'warning':
      return {
        badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
        border: 'border-amber-500/40',
        text: 'text-amber-400',
        bg: 'bg-amber-950/20',
        glow: 'shadow-amber-900/30',
      };
    case 'safe':
    default:
      return {
        badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        border: 'border-emerald-500/40',
        text: 'text-emerald-400',
        bg: 'bg-emerald-950/10',
        glow: 'shadow-emerald-900/20',
      };
  }
}

/**
 * Texto legible para el estado de caducidad.
 */
export function getExpiryLabel(days: number): string {
  if (days < 0) return `Caducado hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return '¡Caduca hoy!';
  if (days === 1) return 'Caduca mañana';
  return `${days} días`;
}

/**
 * Enriquece un PantryItem con su estado de caducidad calculado.
 */
export function enrichItemWithStatus(item: PantryItem): PantryItemWithStatus {
  const daysUntilExpiry = getDaysUntilExpiry(item.expiration_date);
  const expiryStatus = getExpiryStatus(daysUntilExpiry);
  return { ...item, daysUntilExpiry, expiryStatus };
}

/**
 * Ordena los ítems por días hasta caducidad (los más próximos primero).
 */
export function sortByExpiry(items: PantryItemWithStatus[]): PantryItemWithStatus[] {
  return [...items].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

/**
 * Formatea una fecha ISO a formato legible en español.
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}
