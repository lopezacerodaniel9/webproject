'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { X, Receipt, Calendar, ChevronDown, ChevronUp, User } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  activePantryId: string;
}

interface ReceiptRecord {
  id: string;
  total_spent: number;
  created_at: string;
  items_summary: Array<{ name: string; quantity: number; category?: string }>;
  added_by: string;
  user_email?: string;
  user_display_name?: string;
}

export default function ReceiptHistoryModal({ open, onClose, activePantryId }: Props) {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    if (open && activePantryId) {
      fetchReceipts();
    }
  }, [open, activePantryId]);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      // First fetch receipts
      const { data: receiptsData, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('pantry_id', activePantryId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // To display names, we can fetch members info via our RPC
      const { data: membersInfo, error: membersError } = await supabase.rpc('get_pantry_members_info', {
        p_pantry_id: activePantryId
      });

      let enrichedReceipts = receiptsData || [];

      if (!membersError && membersInfo) {
        enrichedReceipts = enrichedReceipts.map(r => {
          const member = membersInfo.find((m: any) => m.member_user_id === r.added_by);
          return {
            ...r,
            user_display_name: member?.member_display_name || 'Usuario desconocido'
          };
        });
      }

      setReceipts(enrichedReceipts);
    } catch (err: any) {
      console.error(err);
      toast.error('Error al cargar el historial de tickets');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('es-ES', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(d);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in-up">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-[#13131f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2 text-foreground">
            <Receipt className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-lg">Historial de Tickets</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-12 px-4 border border-white/5 rounded-xl bg-white/5">
              <Receipt className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-foreground font-medium">Aún no hay tickets escaneados</p>
              <p className="text-muted-foreground text-sm mt-1">Los tickets que escanees aparecerán aquí con su gasto y productos.</p>
            </div>
          ) : (
            receipts.map(receipt => (
              <div key={receipt.id} className="border border-white/10 rounded-xl bg-white/5 overflow-hidden">
                {/* Header (Clickable) */}
                <button 
                  onClick={() => toggleExpand(receipt.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {formatDate(receipt.created_at)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      {receipt.user_display_name}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="font-bold text-emerald-400 text-lg">
                      {receipt.total_spent.toFixed(2)}€
                    </div>
                    {expandedId === receipt.id ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded Content (Items list) */}
                {expandedId === receipt.id && (
                  <div className="p-4 pt-0 border-t border-white/10 bg-black/20">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-3">
                      Productos comprados ({receipt.items_summary.length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {receipt.items_summary.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm p-2 rounded-md bg-white/5">
                          <span className="text-foreground">{item.name}</span>
                          <span className="text-muted-foreground font-mono bg-black/30 px-2 py-0.5 rounded text-xs">x{item.quantity}</span>
                        </div>
                      ))}
                      {receipt.items_summary.length === 0 && (
                        <div className="text-sm text-muted-foreground italic text-center py-2">Sin productos</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

        </div>
      </div>
    </div>
  );
}
