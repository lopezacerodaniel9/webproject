import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  is_checked: boolean;
  added_by: string;
}

interface Props {
  activePantryId: string;
}

export default function ShoppingList({ activePantryId }: Props) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [adding, setAdding] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (activePantryId) {
      fetchList();
    }
  }, [activePantryId]);

  const fetchList = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shopping_list')
        .select('*')
        .eq('pantry_id', activePantryId)
        .order('is_checked', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Error al cargar la lista de la compra');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No estás autenticado');

      const { data, error } = await supabase
        .from('shopping_list')
        .insert({
          pantry_id: activePantryId,
          name: newItemName.trim(),
          added_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      
      // Update local state (insert at top)
      setItems([data, ...items].sort((a, b) => (a.is_checked === b.is_checked ? 0 : a.is_checked ? 1 : -1)));
      setNewItemName('');
    } catch (err: any) {
      console.error(err);
      toast.error('Error al añadir el producto');
    } finally {
      setAdding(false);
    }
  };

  const toggleCheck = async (id: string, currentStatus: boolean) => {
    // Optimistic UI update
    setItems(items.map(item => 
      item.id === id ? { ...item, is_checked: !currentStatus } : item
    ).sort((a, b) => {
      // Re-sort: unchecked first
      const aCheck = a.id === id ? !currentStatus : a.is_checked;
      const bCheck = b.id === id ? !currentStatus : b.is_checked;
      return aCheck === bCheck ? 0 : aCheck ? 1 : -1;
    }));

    try {
      const { error } = await supabase
        .from('shopping_list')
        .update({ is_checked: !currentStatus })
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      toast.error('Error al actualizar el estado');
      fetchList(); // Revert on error
    }
  };

  const clearChecked = async () => {
    const checkedItems = items.filter(i => i.is_checked);
    if (checkedItems.length === 0) return;

    // Optimistic UI
    setItems(items.filter(i => !i.is_checked));

    try {
      const { error } = await supabase
        .from('shopping_list')
        .delete()
        .eq('pantry_id', activePantryId)
        .eq('is_checked', true);

      if (error) throw error;
      toast.success('Lista limpia');
    } catch (err: any) {
      console.error(err);
      toast.error('Error al limpiar la lista');
      fetchList(); // Revert
    }
  };

  const pendingItems = items.filter(i => !i.is_checked);
  const checkedItems = items.filter(i => i.is_checked);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Add Item Bar */}
      <form onSubmit={handleAddItem} className="flex gap-2">
        <Input
          type="text"
          placeholder="¿Qué hace falta comprar?"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          className="flex-1 bg-[#1a1a2e] border-white/10 text-foreground focus:border-indigo-500/50 rounded-xl"
          disabled={adding}
        />
        <Button 
          type="submit" 
          disabled={adding || !newItemName.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </form>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-24">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 px-4 border border-white/5 rounded-2xl bg-white/5">
            <ShoppingCart className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-foreground font-medium">La lista está vacía</p>
            <p className="text-muted-foreground text-sm mt-1">Añade productos para tu próxima compra compartida.</p>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Pending Items */}
            {pendingItems.length > 0 && (
              <div className="space-y-2">
                {pendingItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggleCheck(item.id, item.is_checked)}
                    className="w-full flex items-center justify-between p-3 sm:p-4 rounded-xl border border-white/10 bg-[#1a1a2e] hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Circle className="w-5 h-5 text-muted-foreground" />
                      <span className="text-foreground font-medium">{item.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Checked Items */}
            {checkedItems.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    En el carrito ({checkedItems.length})
                  </span>
                  <button 
                    onClick={clearChecked}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Limpiar
                  </button>
                </div>
                
                {checkedItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggleCheck(item.id, item.is_checked)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5 opacity-60 hover:opacity-100 transition-opacity text-left"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                      <span className="text-muted-foreground line-through decoration-white/20">{item.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
