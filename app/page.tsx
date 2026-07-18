import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { enrichItemWithStatus, sortByExpiry } from '@/utils/dateUtils';
import PantryDashboard from '@/components/pantry/PantryDashboard';
import { GroupedItems, ItemCategory, Pantry, UserPreferences } from '@/types/pantry';

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect('/login');
  }

  // Fetch pantries the user belongs to
  const { data: pantries, error: pantriesError } = await supabase
    .from('pantries')
    .select('*')
    .order('created_at', { ascending: true });

  // Fetch user preferences (for display_name and active_pantry_id)
  const { data: prefsData } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const userPrefs = prefsData as UserPreferences | null;

  // Determine active pantry
  let activePantryId = userPrefs?.active_pantry_id;
  if (!activePantryId && pantries && pantries.length > 0) {
    activePantryId = pantries[0].id;
  }

  const activePantry = pantries?.find(p => p.id === activePantryId) || null;

  // Fetch pantry items for the active pantry
  let items = [];
  if (activePantryId) {
    const { data, error } = await supabase
      .from('pantry_items')
      .select('*')
      .eq('pantry_id', activePantryId)
      .is('deleted_at', null)
      .order('expiration_date', { ascending: true });
    
    if (!error && data) {
      items = data;
    }
  }

  // Enrich items with expiry status
  const enrichedItems = items.map(enrichItemWithStatus);

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
      userPrefs={userPrefs}
      activePantry={activePantry}
      pantries={pantries as Pantry[] || []}
      stats={{ totalItems, critical, expired, warning }}
    />
  );
}
