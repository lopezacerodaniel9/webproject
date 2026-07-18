'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Lock, ChefHat, Eye, EyeOff, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('¡Bienvenido de vuelta!');
        window.location.href = '/';
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success('¡Cuenta creada! Revisa tu email para confirmarla.', { duration: 6000 });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ha ocurrido un error';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#080810]">
      {/* Ambient background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-600/5 blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(oklch(1 0 0 / 40%) 1px, transparent 1px),
                           linear-gradient(90deg, oklch(1 0 0 / 40%) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md px-4 animate-fade-in-up">
        <div className="glass-card rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 mb-4 glow-violet">
              <ChefHat className="w-8 h-8 text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold gradient-text mb-1">
              Asistente Personal
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === 'login'
                ? 'Inicia sesión para gestionar tu inventario'
                : 'Crea tu cuenta para empezar'}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex rounded-xl bg-muted/40 p-1 mb-6">
            <button
              id="tab-login"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                mode === 'login'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              id="tab-register"
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                mode === 'register'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Registrarse
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-muted-foreground">
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="pl-10 bg-white/5 border-white/10 focus:border-violet-500/60 focus:ring-violet-500/20 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-muted-foreground">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="pl-10 pr-10 bg-white/5 border-white/10 focus:border-violet-500/60 focus:ring-violet-500/20 transition-all"
                />
                <button
                  type="button"
                  id="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              id="btn-submit-auth"
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-2.5 rounded-xl transition-all duration-200 glow-violet mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {mode === 'login' ? 'Entrando...' : 'Creando cuenta...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                </>
              )}
            </Button>
          </form>

          {/* Footer note */}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            {mode === 'login' ? (
              <>¿No tienes cuenta?{' '}
                <button id="switch-to-register" onClick={() => setMode('register')} className="text-violet-400 hover:text-violet-300 underline-offset-2 hover:underline transition-colors">
                  Regístrate gratis
                </button>
              </>
            ) : (
              <>¿Ya tienes cuenta?{' '}
                <button id="switch-to-login" onClick={() => setMode('login')} className="text-violet-400 hover:text-violet-300 underline-offset-2 hover:underline transition-colors">
                  Inicia sesión
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
