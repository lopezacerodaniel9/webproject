'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Camera, Upload, Receipt, Trash2, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

interface Props {
  open: boolean;
  onClose: () => void;
  activePantryId: string;
  onUpdate: () => void;
}

interface ReceiptItem {
  id: string; // local temp id
  name: string;
  category: string;
  quantity: number;
  requires_expiration: boolean;
  expiration_date: string;
}

const CATEGORIES = [
  'Lácteos', 'Carnes', 'Frutas y Verduras', 'Despensa',
  'Bebidas', 'Congelados', 'Panadería', 'Limpieza', 'Farmacia', 'Otros'
] as const;

export default function ReceiptScannerModal({ open, onClose, activePantryId, onUpdate }: Props) {
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [totalSpent, setTotalSpent] = useState<number | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [saving, setSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  if (!open) return null;

  const handleClose = () => {
    setStep('upload');
    setTotalSpent(null);
    setItems([]);
    onClose();
  };

  const processImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen válido');
      return;
    }

    setStep('processing');
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        
        const res = await fetch('/api/analyze-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64data }),
        });
        
        if (!res.ok) throw new Error('Error al analizar el ticket con IA');
        
        const aiData = await res.json();
        
        if (aiData.total_spent) setTotalSpent(aiData.total_spent);
        
        if (aiData.items && Array.isArray(aiData.items)) {
          const formattedItems = aiData.items.map((item: any) => ({
            id: crypto.randomUUID(),
            name: item.name || 'Producto Desconocido',
            category: item.category || 'Otros',
            quantity: item.quantity || 1,
            requires_expiration: item.requires_expiration || false,
            expiration_date: ''
          }));
          setItems(formattedItems);
        } else {
          setItems([]);
        }

        setStep('review');
        toast.success('Ticket procesado. Revisa los productos.');
      };
      reader.readAsDataURL(compressed);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error al procesar el ticket');
      setStep('upload');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const updateItemDate = (id: string, date: string) => {
    setItems(items.map(item => item.id === id ? { ...item, expiration_date: date } : item));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSaveAll = async () => {
    // Validate that required dates are filled
    const missingDates = items.some(item => item.requires_expiration && !item.expiration_date);
    if (missingDates) {
      toast.error('Por favor rellena la fecha de caducidad en los productos marcados.');
      return;
    }

    if (items.length === 0) {
      toast.error('No hay productos para guardar.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const inserts = items.map(item => ({
        added_by: user.id,
        pantry_id: activePantryId,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: 'unidades',
        expiration_date: item.expiration_date || '2099-12-31'
      }));

      const { error } = await supabase.from('pantry_items').insert(inserts);
      if (error) throw error;

      // Save receipt history
      const itemsSummary = items.map(i => ({ name: i.name, quantity: i.quantity, category: i.category }));
      const { error: receiptError } = await supabase.from('receipts').insert({
        pantry_id: activePantryId,
        added_by: user.id,
        total_spent: totalSpent || 0,
        items_summary: itemsSummary
      });
      if (receiptError) console.error('Error saving receipt history:', receiptError);

      toast.success(`${items.length} productos añadidos a la despensa`);
      onUpdate();
      handleClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error al guardar los productos');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in-up">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      
      <div className="relative w-full max-w-2xl bg-[#13131f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2 text-foreground">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <h2 className="font-semibold text-lg">Lector de Ticket Inteligente</h2>
          </div>
          <button onClick={handleClose} className="p-1 rounded-full hover:bg-white/10 text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12 px-4 space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-600/20 flex items-center justify-center">
                <Receipt className="w-10 h-10 text-emerald-400" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-foreground">Sube o haz una foto de tu ticket</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  Nuestra IA analizará tu ticket, extraerá los productos, los agrupará y te preparará la lista para añadirla a tu despensa.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
                <Button onClick={() => cameraInputRef.current?.click()} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-6">
                  <Camera className="w-5 h-5 mr-2" />
                  Hacer Foto
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white/10 hover:bg-white/20 text-white rounded-xl py-6">
                  <Upload className="w-5 h-5 mr-2" />
                  Subir Foto
                </Button>
                <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-20 px-4 space-y-4">
              <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
              <h3 className="text-lg font-medium text-foreground">La IA está leyendo tu ticket...</h3>
              <p className="text-muted-foreground text-sm">Esto puede tardar unos segundos</p>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-6">
              {totalSpent !== null && (
                <div className="bg-emerald-600/10 border border-emerald-500/20 rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-emerald-400 font-semibold text-sm uppercase tracking-wider">Resumen del Ticket</h3>
                    <p className="text-foreground text-sm mt-1">Gasto total detectado</p>
                  </div>
                  <div className="text-3xl font-bold text-emerald-400">
                    {totalSpent.toFixed(2)}€
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-foreground font-medium">Productos Extraídos ({items.length})</h3>
                  <p className="text-xs text-muted-foreground">Por favor, rellena las fechas necesarias</p>
                </div>

                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className={`p-4 rounded-xl border ${item.requires_expiration && !item.expiration_date ? 'bg-amber-500/5 border-amber-500/30' : 'bg-white/5 border-white/10'} flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{item.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">
                            x{item.quantity}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.category}</p>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        {item.requires_expiration ? (
                          <div className="flex-1 sm:w-40 relative">
                            <CalendarIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="date"
                              required
                              value={item.expiration_date}
                              onChange={(e) => updateItemDate(item.id, e.target.value)}
                              className={`pl-9 ${!item.expiration_date ? 'border-amber-500/50 focus:border-amber-500' : 'border-white/10 focus:border-emerald-500/50'} bg-black/20`}
                            />
                          </div>
                        ) : (
                          <div className="flex-1 sm:w-40 flex items-center justify-center gap-2 text-xs text-muted-foreground italic bg-black/20 rounded-md py-2 px-3 border border-white/5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500/70" /> No perecedero
                          </div>
                        )}
                        <Button 
                          variant="ghost" 
                          onClick={() => removeItem(item.id)}
                          className="px-2 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {items.length === 0 && (
                    <div className="p-8 text-center border border-white/10 border-dashed rounded-xl">
                      <p className="text-muted-foreground">No se detectaron productos. ¿Estaba la foto borrosa?</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {step === 'review' && (
          <div className="p-4 border-t border-white/10 bg-white/5">
            <Button
              onClick={handleSaveAll}
              disabled={saving || items.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-6 text-lg shadow-lg shadow-emerald-900/30"
            >
              {saving ? 'Guardando...' : `Añadir ${items.length} productos a la despensa`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
