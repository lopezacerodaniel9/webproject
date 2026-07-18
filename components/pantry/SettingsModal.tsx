'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, User } from 'lucide-react';
import { toast } from 'sonner';
import { UserPreferences } from '@/types/pantry';

interface Props {
  open: boolean;
  onClose: () => void;
  userPrefs: UserPreferences | null;
  userEmail: string;
  onUpdate: () => void;
}

export default function SettingsModal({ open, onClose, userPrefs, userEmail, onUpdate }: Props) {
  const [displayName, setDisplayName] = useState(userPrefs?.display_name || '');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          display_name: displayName.trim() || null,
        });

      if (error) throw error;

      toast.success('Perfil actualizado correctamente');
      onUpdate();
      onClose();
    } catch (err: any) {
      toast.error('Error al actualizar el perfil');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in-up">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-[#13131f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2 text-foreground">
            <User className="w-5 h-5 text-violet-400" />
            <h2 className="font-semibold text-lg">Ajustes de Perfil</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Correo Electrónico
              </label>
              <Input
                type="text"
                value={userEmail}
                disabled
                className="bg-white/5 border-white/10 text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground/60 mt-1">
                El correo no se puede cambiar.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Nombre de usuario
              </label>
              <Input
                type="text"
                placeholder="Ej. Dani, Familia López..."
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-white/5 border-white/10 focus:border-violet-500/50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Este nombre lo verán otros miembros si compartes tu despensa.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-lg shadow-violet-900/30"
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
