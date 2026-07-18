'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Users, Copy, Check, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Pantry } from '@/types/pantry';

interface Props {
  open: boolean;
  onClose: () => void;
  activePantry: Pantry | null;
  onUpdate: () => void;
}

export default function ShareModal({ open, onClose, activePantry, onUpdate }: Props) {
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const supabase = createClient();

  if (!open || !activePantry) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activePantry.share_code);
    setCopied(true);
    toast.success('Código copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setLoading(true);
    try {
      // Call RPC to join pantry
      const { data, error } = await supabase.rpc('join_pantry_by_code', {
        p_share_code: joinCode.trim()
      });

      if (error) {
        console.error(error);
        throw new Error('Código inválido o ya eres miembro de esta despensa');
      }

      toast.success('¡Te has unido a la despensa compartida!');
      setJoinCode('');
      onUpdate();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error al unirse a la despensa');
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
            <Users className="w-5 h-5 text-violet-400" />
            <h2 className="font-semibold text-lg">Gestionar Despensa</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-8">
          
          {/* Share Current Pantry */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">Invitar a alguien</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Comparte este código secreto para que otras personas puedan ver y editar esta despensa.
              </p>
            </div>
            
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  type="text"
                  value={activePantry.share_code}
                  readOnly
                  className="bg-white/5 border-white/10 text-violet-300 font-mono text-center tracking-wider pr-10"
                />
              </div>
              <Button
                type="button"
                onClick={handleCopyCode}
                className="bg-white/10 hover:bg-white/20 text-white rounded-xl px-3"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="h-px bg-white/5 w-full" />

          {/* Join Another Pantry */}
          <form onSubmit={handleJoin} className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">Unirse a una despensa</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Si alguien te ha invitado, introduce aquí su código secreto.
              </p>
            </div>
            
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Ej. d3b07384-..."
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="flex-1 bg-white/5 border-white/10 focus:border-emerald-500/50 font-mono"
              />
              <Button
                type="submit"
                disabled={loading || !joinCode.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-900/30"
              >
                {loading ? 'Uniendo...' : 'Unirme'}
              </Button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
