'use client';

import { PackageOpen, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onAddItem: () => void;
}

export default function EmptyState({ onAddItem }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in-up">
      {/* Glowing icon */}
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-violet-600/20 blur-2xl scale-150" />
        <div className="relative w-20 h-20 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
          <PackageOpen className="w-10 h-10 text-violet-400/60" />
        </div>
      </div>

      <h3 className="text-xl font-bold text-foreground/80 mb-2">Tu despensa está vacía</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-8">
        Añade productos a tu inventario para controlar sus fechas de caducidad y no desperdiciar nada.
      </p>

      <Button
        id="btn-empty-state-add"
        onClick={onAddItem}
        className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl gap-2 shadow-lg shadow-violet-900/40 px-6 py-3 h-auto"
      >
        <Plus className="w-4 h-4" />
        Añadir mi primer producto
      </Button>
    </div>
  );
}
