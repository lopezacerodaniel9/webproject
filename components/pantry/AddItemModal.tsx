'use client';

import { useState, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { autoCategory } from '@/utils/categorizer';
import { CATEGORIES, UNITS, ItemCategory, ItemUnit, NewPantryItem } from '@/types/pantry';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Camera, Upload, X, Loader2, Sparkles, Wand2, ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import Image from 'next/image';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_FILE_SIZE_MB = 5;
const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
};

export default function AddItemModal({ open, onClose, onSuccess }: Props) {
  const supabase = createClient();

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ItemCategory>('Otros');
  const [categoryAutoSet, setCategoryAutoSet] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<ItemUnit>('unidades');
  const [expirationDate, setExpirationDate] = useState('');
  const [notes, setNotes] = useState('');

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  // Submit state
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setName('');
    setCategory('Otros');
    setCategoryAutoSet(false);
    setQuantity('');
    setUnit('unidades');
    setExpirationDate('');
    setNotes('');
    setImageFile(null);
    setImagePreview(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // Auto-categorize on name change
  const handleNameChange = (value: string) => {
    setName(value);
    if (value.trim().length >= 3) {
      const detected = autoCategory(value);
      if (detected !== 'Otros') {
        setCategory(detected);
        setCategoryAutoSet(true);
      } else if (categoryAutoSet) {
        setCategoryAutoSet(false);
      }
    }
  };

  // Handle image selection (gallery, file explorer, or camera)
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`La imagen no puede superar ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen válido');
      return;
    }

    setCompressing(true);
    try {
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
      setImageFile(compressed);

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        setImagePreview(base64data);
        
        // --- Gemini AI Analysis ---
        setAnalyzing(true);
        try {
          const res = await fetch('/api/analyze-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64data }),
          });
          
          if (res.ok) {
            const aiData = await res.json();
            console.log('--- RESPUESTA BRUTA DE LA IA (GEMINI) ---');
            console.log(aiData.rawResponse);
            console.log('--- DATOS PROCESADOS ---');
            console.log(aiData);
            
            // Auto-fill name if empty
            if (aiData.name && !name) {
              setName(aiData.name);
              if (aiData.category && CATEGORIES.includes(aiData.category)) {
                setCategory(aiData.category as ItemCategory);
                setCategoryAutoSet(true);
              }
            }
            
            // Auto-fill expiration date
            if (aiData.expirationDate && !expirationDate) {
              setExpirationDate(aiData.expirationDate);
              toast.success('Fecha de caducidad detectada por IA ✨');
            } else if (!aiData.expirationDate) {
              toast.info('La IA no encontró una fecha. Por favor, introdúcela manualmente.');
            }
          } else {
            try {
              const errData = await res.json();
              console.error('Error de IA:', errData);
              if (errData.rawResponse) {
                console.log('--- RESPUESTA BRUTA DE LA IA (ERROR) ---');
                console.log(errData.rawResponse);
              }
            } catch (e) {}
            toast.error('No se pudo analizar la imagen');
          }
        } catch (error) {
          console.error('Error in AI analysis:', error);
          toast.error('Error al analizar la imagen con IA');
        } finally {
          setAnalyzing(false);
        }
      };
      reader.readAsDataURL(compressed);
    } catch {
      toast.error('Error al procesar la imagen');
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setCompressing(false);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Upload image to Supabase Storage
  const uploadImage = async (userId: string): Promise<string | null> => {
    if (!imageFile) return null;

    const ext = imageFile.name.split('.').pop() ?? 'jpg';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from('item_images')
      .upload(fileName, imageFile, {
        contentType: imageFile.type,
        upsert: false,
      });

    if (error) {
      console.error('Storage error:', error);
      toast.warning('No se pudo subir la imagen, pero el producto se guardará sin ella');
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('item_images')
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) { toast.error('El nombre es obligatorio'); return; }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      // Upload image if present
      const imageUrl = await uploadImage(user.id);

      const newItem: NewPantryItem & { user_id: string } = {
        user_id: user.id,
        name: name.trim(),
        category,
        quantity: quantity ? parseFloat(quantity) : null,
        unit: quantity ? unit : null,
        expiration_date: expirationDate || null,
        image_url: imageUrl,
        notes: notes.trim() || null,
      };

      const { error } = await supabase.from('pantry_items').insert(newItem);
      if (error) throw error;

      toast.success(`"${name}" añadido a tu despensa 🎉`);
      handleClose();
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el producto';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Get today's date for min date
  const today = new Date().toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg bg-[#13131f] border-white/10 p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/5 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            </div>
            Añadir producto
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            {/* Product Name */}
            <div className="space-y-1.5">
              <Label htmlFor="item-name" className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Nombre del producto *
              </Label>
              <Input
                id="item-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: Leche entera, Pollo fresco..."
                required
                className="bg-white/5 border-white/10 focus:border-violet-500/60 h-10"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-2">
                Categoría
                {categoryAutoSet && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-full">
                    <Wand2 className="w-2.5 h-2.5" />
                    Auto-detectada
                  </span>
                )}
              </Label>
              <Select value={category} onValueChange={(v) => { setCategory(v as ItemCategory); setCategoryAutoSet(false); }}>
                <SelectTrigger id="item-category" className="bg-white/5 border-white/10 focus:border-violet-500/60 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="focus:bg-violet-600/20 focus:text-violet-300">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-quantity" className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Cantidad
                </Label>
                <Input
                  id="item-quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Ej: 2"
                  className="bg-white/5 border-white/10 focus:border-violet-500/60 h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Unidad
                </Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as ItemUnit)}>
                  <SelectTrigger id="item-unit" className="bg-white/5 border-white/10 focus:border-violet-500/60 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-white/10">
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u} className="focus:bg-violet-600/20 focus:text-violet-300">
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Expiration Date */}
            <div className="space-y-1.5">
              <Label htmlFor="item-expiration" className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Fecha de caducidad (opcional)
              </Label>
              <Input
                id="item-expiration"
                type="date"
                value={expirationDate}
                min={today}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="bg-white/5 border-white/10 focus:border-violet-500/60 h-10 [color-scheme:dark]"
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Foto del producto
              </Label>

              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-white/10 h-40">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    className="object-cover"
                    sizes="500px"
                  />
                  <button
                    type="button"
                    id="btn-remove-image"
                    onClick={removeImage}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {compressing && !analyzing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="flex items-center gap-2 text-sm text-white font-medium">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Comprimiendo...
                      </div>
                    </div>
                  )}
                  {analyzing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-2 text-sm text-violet-300 font-medium">
                        <Wand2 className="w-6 h-6 animate-pulse" />
                        <span className="animate-pulse">Analizando con IA...</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {/* Gallery / File picker */}
                  <button
                    type="button"
                    id="btn-upload-gallery"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.removeAttribute('capture');
                        fileInputRef.current.click();
                      }
                    }}
                    className="flex flex-col items-center gap-2 py-4 rounded-xl border border-dashed border-white/10 bg-white/3 hover:bg-white/5 hover:border-violet-500/30 transition-all duration-200 text-muted-foreground hover:text-foreground"
                  >
                    <Upload className="w-5 h-5" />
                    <span className="text-xs font-medium">Galería / Archivo</span>
                  </button>

                  {/* Camera */}
                  <button
                    type="button"
                    id="btn-upload-camera"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.setAttribute('capture', 'environment');
                        fileInputRef.current.click();
                      }
                    }}
                    className="flex flex-col items-center gap-2 py-4 rounded-xl border border-dashed border-white/10 bg-white/3 hover:bg-white/5 hover:border-violet-500/30 transition-all duration-200 text-muted-foreground hover:text-foreground"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-xs font-medium">Cámara</span>
                  </button>
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                id="item-image-input"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="item-notes" className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Notas (opcional)
              </Label>
              <Textarea
                id="item-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Comprado en Mercadona, abrir antes del..."
                rows={2}
                className="bg-white/5 border-white/10 focus:border-violet-500/60 resize-none text-sm"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-white/5 flex gap-3">
            <Button
              type="button"
              id="btn-cancel-add"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-foreground"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              id="btn-save-item"
              disabled={loading || compressing || analyzing}
              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white glow-violet"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Guardar producto
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
