'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { CATEGORIES, UNITS, ItemCategory, ItemUnit, PantryItem } from '@/types/pantry';
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
import { Camera, Upload, X, Loader2, Save, ImageIcon, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import Image from 'next/image';

interface Props {
  item: PantryItem;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
};

export default function EditItemModal({ item, open, onClose, onSuccess }: Props) {
  const supabase = createClient();

  // Form state (pre-filled with item data)
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<ItemCategory>(item.category as ItemCategory);
  const [quantity, setQuantity] = useState(item.quantity?.toString() ?? '');
  const [unit, setUnit] = useState<ItemUnit>((item.unit as ItemUnit) ?? 'unidades');
  const [expirationDate, setExpirationDate] = useState(item.expiration_date || '');
  const [notes, setNotes] = useState(item.notes ?? '');

  // Image state
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(item.image_url);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when item changes
  useEffect(() => {
    setName(item.name);
    setCategory(item.category as ItemCategory);
    setQuantity(item.quantity?.toString() ?? '');
    setUnit((item.unit as ItemUnit) ?? 'unidades');
    setExpirationDate(item.expiration_date || '');
    setNotes(item.notes ?? '');
    setCurrentImageUrl(item.image_url);
    setNewImageFile(null);
    setNewImagePreview(null);
    setRemoveCurrentImage(false);
  }, [item]);

  const handleClose = useCallback(() => {
    setNewImageFile(null);
    setNewImagePreview(null);
    onClose();
  }, [onClose]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen válido');
      return;
    }

    setCompressing(true);
    try {
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
      setNewImageFile(compressed);
      setRemoveCurrentImage(false);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        setNewImagePreview(base64data);
        
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
            
            // Auto-fill name if we want, or leave as is if editing
            if (aiData.name && !name) {
              setName(aiData.name);
            }
            
            // Auto-fill expiration date
            if (aiData.expirationDate) {
              setExpirationDate(aiData.expirationDate);
              toast.success('Fecha de caducidad actualizada por IA ✨');
            } else {
              toast.info('La IA no encontró una nueva fecha.');
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
      setNewImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setNewImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setCompressing(false);
    }
  };

  const handleRemoveImage = () => {
    setRemoveCurrentImage(true);
    setCurrentImageUrl(null);
    setNewImageFile(null);
    setNewImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadNewImage = async (userId: string): Promise<string | null> => {
    if (!newImageFile) return null;

    const ext = newImageFile.name.split('.').pop() ?? 'jpg';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from('item_images')
      .upload(fileName, newImageFile, {
        contentType: newImageFile.type,
        upsert: false,
      });

    if (error) {
      toast.warning('No se pudo subir la nueva imagen');
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('item_images')
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const deleteOldImage = async (oldUrl: string) => {
    const urlParts = oldUrl.split('/item_images/');
    if (urlParts[1]) {
      await supabase.storage.from('item_images').remove([urlParts[1]]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('El nombre es obligatorio'); return; }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      let finalImageUrl: string | null = currentImageUrl;

      // Handle image changes
      if (newImageFile) {
        // Upload new image
        if (item.image_url) await deleteOldImage(item.image_url);
        finalImageUrl = await uploadNewImage(user.id);
      } else if (removeCurrentImage && item.image_url) {
        // Remove existing image
        await deleteOldImage(item.image_url);
        finalImageUrl = null;
      }

      const { error } = await supabase
        .from('pantry_items')
        .update({
          name: name.trim(),
          category,
          quantity: quantity ? parseFloat(quantity) : null,
          unit: quantity ? unit : null,
          expiration_date: expirationDate || null,
          image_url: finalImageUrl,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (error) throw error;

      toast.success(`"${name}" actualizado correctamente ✓`);
      handleClose();
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar el producto';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const showImagePreview = newImagePreview || (currentImageUrl && !removeCurrentImage);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg bg-[#13131f] border-white/10 p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/5 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Save className="w-3.5 h-3.5 text-amber-400" />
            </div>
            Editar producto
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-item-name" className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Nombre del producto *
              </Label>
              <Input
                id="edit-item-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-white/5 border-white/10 focus:border-amber-500/60 h-10"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Categoría
              </Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ItemCategory)}>
                <SelectTrigger id="edit-item-category" className="bg-white/5 border-white/10 focus:border-amber-500/60 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="focus:bg-amber-600/20">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-item-quantity" className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Cantidad
                </Label>
                <Input
                  id="edit-item-quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Ej: 2"
                  className="bg-white/5 border-white/10 focus:border-amber-500/60 h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Unidad
                </Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as ItemUnit)}>
                  <SelectTrigger id="edit-item-unit" className="bg-white/5 border-white/10 focus:border-amber-500/60 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-white/10">
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u} className="focus:bg-amber-600/20">
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Expiration Date */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-item-expiration" className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Fecha de caducidad (opcional)
              </Label>
              <Input
                id="edit-item-expiration"
                type="date"
                value={expirationDate || ''}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="bg-white/5 border-white/10 focus:border-amber-500/60 h-10 [color-scheme:dark]"
              />
            </div>

            {/* Image */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Foto del producto
              </Label>

              {showImagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-white/10 h-40">
                  <Image
                    src={newImagePreview ?? currentImageUrl!}
                    alt={name}
                    fill
                    className="object-cover"
                    sizes="500px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-2 right-2 flex gap-2">
                    {/* Replace image */}
                    <button
                      type="button"
                      id="btn-edit-replace-image"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.removeAttribute('capture');
                          fileInputRef.current.click();
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm flex items-center gap-1.5"
                    >
                      <Upload className="w-3 h-3" />
                      Cambiar
                    </button>
                    {/* Remove image */}
                    <button
                      type="button"
                      id="btn-edit-remove-image"
                      onClick={handleRemoveImage}
                      className="px-2 py-1 rounded-lg bg-red-900/70 text-red-300 hover:bg-red-800/70 transition-colors backdrop-blur-sm"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {compressing && !analyzing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="flex items-center gap-2 text-sm text-white">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Procesando...
                      </div>
                    </div>
                  )}
                  {analyzing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-2 text-sm text-amber-300 font-medium">
                        <Wand2 className="w-6 h-6 animate-pulse" />
                        <span className="animate-pulse">Analizando...</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    id="btn-edit-upload-gallery"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.removeAttribute('capture');
                        fileInputRef.current.click();
                      }
                    }}
                    className="flex flex-col items-center gap-2 py-4 rounded-xl border border-dashed border-white/10 bg-white/3 hover:bg-white/5 hover:border-amber-500/30 transition-all text-muted-foreground hover:text-foreground"
                  >
                    <Upload className="w-5 h-5" />
                    <span className="text-xs font-medium">Galería / Archivo</span>
                  </button>
                  <button
                    type="button"
                    id="btn-edit-upload-camera"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.setAttribute('capture', 'environment');
                        fileInputRef.current.click();
                      }
                    }}
                    className="flex flex-col items-center gap-2 py-4 rounded-xl border border-dashed border-white/10 bg-white/3 hover:bg-white/5 hover:border-amber-500/30 transition-all text-muted-foreground hover:text-foreground"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-xs font-medium">Cámara</span>
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                id="edit-image-input"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-item-notes" className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Notas (opcional)
              </Label>
              <Textarea
                id="edit-item-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="bg-white/5 border-white/10 focus:border-amber-500/60 resize-none text-sm"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-white/5 flex gap-3">
            <Button
              type="button"
              id="btn-cancel-edit"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-foreground"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              id="btn-save-edit"
              disabled={loading || compressing || analyzing}
              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar cambios
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
