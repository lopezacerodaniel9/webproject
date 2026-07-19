'use client';

import { useState, useEffect } from 'react';
import { PantryItemWithStatus } from '@/types/pantry';
import { CheckCircle2, X, Coffee, Utensils, MoonStar, ChevronDown } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

interface Props {
  items: PantryItemWithStatus[];
  onConsumeSuccess: () => void;
}

type MealTime = 'breakfast' | 'lunch' | 'dinner' | null;

export default function DailyCheckIn({ items, onConsumeSuccess }: Props) {
  const [meal, setMeal] = useState<MealTime>(null);
  const [dismissed, setDismissed] = useState(true); // Default to true to prevent hydration mismatch flashes
  const [suggestions, setSuggestions] = useState<PantryItemWithStatus[]>([]);
  const [showAll, setShowAll] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    checkTimeAndStatus();
    // Re-check every 5 minutes in case the app is left open
    const interval = setInterval(checkTimeAndStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [items]);

  const checkTimeAndStatus = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const time = hours + minutes / 60;

    let currentMeal: MealTime = null;

    if (time >= 8 && time < 11.5) {
      currentMeal = 'breakfast';
    } else if (time >= 14 && time < 16.5) {
      currentMeal = 'lunch';
    } else if (time >= 21 && time < 23.5) {
      currentMeal = 'dinner';
    }

    setMeal(currentMeal);

    if (currentMeal) {
      const todayStr = now.toISOString().split('T')[0];
      const storageKey = `pantry-checkin-${todayStr}-${currentMeal}`;
      const isDismissed = localStorage.getItem(storageKey) === 'true';
      setDismissed(isDismissed);

      if (!isDismissed) {
        generateSuggestions();
      }
    } else {
      setDismissed(true);
    }
  };

  const generateSuggestions = () => {
    // Priority: critical, warning, expired, then others
    const sorted = [...items].sort((a, b) => {
      const rank = (s: string) => s === 'expired' ? 3 : s === 'critical' ? 2 : s === 'warning' ? 1 : 0;
      return rank(b.expiryStatus) - rank(a.expiryStatus);
    });

    setSuggestions(sorted.slice(0, 4));
  };

  const markAsDone = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const storageKey = `pantry-checkin-${todayStr}-${meal}`;
    localStorage.setItem(storageKey, 'true');
    setDismissed(true);
  };

  const handleConsume = async (item: PantryItemWithStatus) => {
    try {
      const { error } = await supabase
        .from('pantry_items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      const actionToast = {
        label: 'A la lista 🛒',
        onClick: async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { error: err } = await supabase.from('shopping_list').insert({
              pantry_id: item.pantry_id,
              name: item.name,
              added_by: user.id
            });
            if (err) throw err;
            toast.success(`"${item.name}" en tu lista de compra`);
          } catch (e) {
            toast.error('Error al añadir a la lista');
          }
        }
      };

      toast.success(`"${item.name}" marcado como consumido ✓`, { 
        action: actionToast,
        duration: 6000
      });
      
      markAsDone();
      onConsumeSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Error al marcar producto');
    }
  };

  if (dismissed || !meal || items.length === 0) return null;

  const mealConfig = {
    breakfast: { title: 'Post-Desayuno', icon: Coffee, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', greeting: '¡Buenos días!' },
    lunch: { title: 'Post-Comida', icon: Utensils, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', greeting: '¡Buenas tardes!' },
    dinner: { title: 'Post-Cena', icon: MoonStar, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', greeting: '¡Buenas noches!' },
  }[meal];

  const Icon = mealConfig.icon;
  const otherItems = items.filter(i => !suggestions.find(s => s.id === i.id));

  return (
    <div className={`mb-6 rounded-2xl border ${mealConfig.border} ${mealConfig.bg} p-4 sm:p-5 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500 shadow-lg`}>
      <button 
        onClick={markAsDone}
        className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/10 text-muted-foreground transition-colors"
        title="Ocultar"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${mealConfig.border} bg-white/5`}>
          <Icon className={`w-5 h-5 ${mealConfig.color}`} />
        </div>
        <div>
          <h3 className="font-bold text-foreground">{mealConfig.greeting}</h3>
          <p className="text-sm text-muted-foreground">¿Has gastado algo en tu {mealConfig.title.toLowerCase().replace('post-', '')}?</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Priority Suggestions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {suggestions.map(item => (
            <button
              key={item.id}
              onClick={() => handleConsume(item)}
              className="group flex flex-col items-center justify-center p-3 rounded-xl bg-black/20 hover:bg-black/40 border border-white/5 hover:border-white/20 transition-all text-center h-full"
            >
              <span className="text-sm font-medium text-foreground line-clamp-2 leading-tight group-hover:text-emerald-400 transition-colors">
                {item.name}
              </span>
              <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Marcar
              </span>
            </button>
          ))}
        </div>

        {/* Other Items Dropdown */}
        {otherItems.length > 0 && (
          <div className="pt-2">
            {!showAll ? (
              <button 
                onClick={() => setShowAll(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors border border-dashed border-white/10"
              >
                Ver otros productos de tu despensa <ChevronDown className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="animate-in fade-in slide-in-from-top-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  Otros productos
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                  {otherItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleConsume(item)}
                      className="group flex flex-col items-center justify-center p-2.5 rounded-xl bg-black/20 hover:bg-black/40 border border-white/5 hover:border-white/20 transition-all text-center"
                    >
                      <span className="text-xs font-medium text-foreground/80 line-clamp-1 group-hover:text-emerald-400 transition-colors">
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-2">
          <button 
            onClick={markAsDone}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-foreground bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
          >
            No he gastado nada (Descartar)
          </button>
        </div>
      </div>
    </div>
  );
}
