import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { enrichItemWithStatus, sortByExpiry } from '@/utils/dateUtils';
import PantryDashboard from '@/components/pantry/PantryDashboard';
import { GroupedItems, ItemCategory } from '@/types/pantry';

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect('/login');
  }

  // Fetch pantry items (active only, no soft-deleted)
  const { data: items, error } = await supabase
    .from('pantry_items')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('expiration_date', { ascending: true });

  if (error) {
    console.error('Error fetching pantry items:', error);
  }

  // Enrich items with expiry status
  const enrichedItems = (items ?? []).map(enrichItemWithStatus);

  // Group by category
  const groupMap = new Map<ItemCategory, typeof enrichedItems>();
  for (const item of enrichedItems) {
    const cat = item.category as ItemCategory;
    if (!groupMap.has(cat)) groupMap.set(cat, []);
    groupMap.get(cat)!.push(item);
  }

  // Sort items within each group by expiry, and sort groups by most urgent item
  const grouped: GroupedItems[] = Array.from(groupMap.entries())
    .map(([category, catItems]) => ({
      category,
      items: sortByExpiry(catItems),
    }))
    .sort((a, b) => {
      const aMin = a.items[0]?.daysUntilExpiry ?? Infinity;
      const bMin = b.items[0]?.daysUntilExpiry ?? Infinity;
      return aMin - bMin;
    });

  // Stats for header
  const totalItems = enrichedItems.length;
  const critical = enrichedItems.filter((i) => i.expiryStatus === 'critical').length;
  const expired = enrichedItems.filter((i) => i.expiryStatus === 'expired').length;
  const warning = enrichedItems.filter((i) => i.expiryStatus === 'warning').length;

  return (
    <PantryDashboard
      grouped={grouped}
      userEmail={user.email ?? ''}
      stats={{ totalItems, critical, expired, warning }}
    />
  );
}
