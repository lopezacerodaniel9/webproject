'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Users, Copy, Check, Edit2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Pantry, UserPreferences } from '@/types/pantry';

interface Props {
  open: boolean;
  onClose: () => void;
  activePantry: Pantry | null;
  userPrefs: UserPreferences | null;
  onUpdate: () => void;
}

interface Member {
  member_user_id: string;
  member_role: string;
  member_display_name: string;
}

export default function ShareModal({ open, onClose, activePantry, userPrefs, onUpdate }: Props) {
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [pantryName, setPantryName] = useState('');
  const [savingName, setSavingName] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    if (open && activePantry) {
      setPantryName(activePantry.name);
      fetchMembers();
    }
  }, [open, activePantry]);

  const fetchMembers = async () => {
    if (!activePantry) return;
    try {
      const { data, error } = await supabase.rpc('get_pantry_members_info', {
        p_pantry_id: activePantry.id
      });
      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  if (!open || !userPrefs || !activePantry) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(userPrefs.invite_code);
    setCopied(true);
    toast.success('Código copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_shared_pantry_by_code', {
        p_friend_code: joinCode.trim()
      });

      if (error) {
        console.error(error);
        throw new Error('Código de amigo inválido');
      }

      toast.success('¡Despensa compartida creada con éxito!');
      setJoinCode('');
      onUpdate();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error al conectar con tu amigo');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!pantryName.trim() || pantryName === activePantry.name) {
      setIsEditingName(false);
      return;
    }

    setSavingName(true);
    try {
      const { error } = await supabase
        .from('pantries')
        .update({ name: pantryName.trim() })
        .eq('id', activePantry.id);

      if (error) throw error;
      
      toast.success('Nombre actualizado');
      setIsEditingName(false);
      onUpdate();
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar el nombre. Puede que no tengas permisos.');
      setPantryName(activePantry.name); // revert
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in-up">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-[#13131f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2 text-foreground">
            <Users className="w-5 h-5 text-violet-400" />
            <h2 className="font-semibold text-lg">Gestionar Entorno</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-8">
          
          {/* Pantry Name Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Nombre de este entorno</h3>
            <div className="flex gap-2 items-center">
              {isEditingName ? (
                <>
                  <Input
                    type="text"
                    value={pantryName}
                    onChange={(e) => setPantryName(e.target.value)}
                    className="flex-1 bg-white/5 border-white/10 focus:border-violet-500/50"
                    autoFocus
                  />
                  <Button 
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 rounded-xl"
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button 
                    onClick={() => { setIsEditingName(false); setPantryName(activePantry.name); }}
                    variant="ghost"
                    className="px-3 hover:bg-white/10 rounded-xl text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex-1 px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-foreground truncate">
                    {activePantry.name}
                  </div>
                  <Button
                    onClick={() => setIsEditingName(true)}
                    variant="ghost"
                    className="px-3 hover:bg-white/10 rounded-xl text-violet-400"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="h-px bg-white/5 w-full" />

          {/* Members List */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Miembros de este entorno</h3>
            <div className="space-y-2">
              {members.length === 0 ? (
                <div className="text-sm text-muted-foreground italic">Cargando miembros...</div>
              ) : (
                members.map(member => (
                  <div key={member.member_user_id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-600/20 text-violet-400 flex items-center justify-center font-bold text-sm uppercase">
                        {member.member_display_name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {member.member_display_name}
                      </span>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-md bg-white/5 text-muted-foreground">
                      {member.member_role === 'owner' ? 'Dueño' : 'Miembro'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="h-px bg-white/5 w-full" />

          {/* Share Current Pantry */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">Tu código de amigo</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Envía este código a tu pareja. Cuando lo usen, se creará una "Despensa Compartida" entre ambos.
              </p>
            </div>
            
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  type="text"
                  value={userPrefs.invite_code}
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
              <h3 className="text-sm font-medium text-foreground">Usar código de amigo</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Pega aquí el código de otra persona para empezar a compartir.
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
                {loading ? 'Conectando...' : 'Conectar'}
              </Button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
