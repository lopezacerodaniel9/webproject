'use client';

import { useState, useTransition } from 'react';
import { PantryItemWithStatus } from '@/types/pantry';
import { getExpiryColorClasses, getExpiryLabel, formatDate } from '@/utils/dateUtils';
import { createClient } from '@/utils/supabase/client';
import { Trash2, CheckCircle2, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import EditItemModal from './EditItemModal';

interface Props {
  item: PantryItemWithStatus;
  onDeleted: () => void;
}

export default function ItemCard({ item, onDeleted }: Props) {
  const [isPending, startTransition] = useTransition();
  const [imageError, setImageError] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const colors = getExpiryColorClasses(item.expiryStatus);
  const supabase = createClient();

  const handleMarkConsumed = async () => {
    startTransition(async () => {
      const { error } = await supabase
        .from('pantry_items')
        .delete()
        .eq('id', item.id);

      if (error) {
        console.error('Consume error:', error);
        toast.error('Error al marcar como consumido');
        return;
      }
      const actionToast = {
        label: 'A la lista 🛒',
        onClick: async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { error: err } = await supabase.from('shopping_list').insert({
              pantry_id: item.pantry_id,
              name: item.name,
              added_by: user.id
            });
            if (err) throw err;
            toast.success(`"${item.name}" en tu lista de compra`);
          } catch (e) {
            toast.error('Error al añadir a la lista');
          }
        }
      };

      toast.success(`"${item.name}" marcado como consumido ✓`, { 
        action: actionToast,
        duration: 6000
      });
      onDeleted();
    });
  };

  const handleDelete = async () => {
    startTransition(async () => {
      const { error } = await supabase
        .from('pantry_items')
        .delete()
        .eq('id', item.id);

      if (error) {
        console.error('Delete error:', error);
        toast.error('Error al eliminar el producto');
        return;
      }

      if (item.image_url) {
        const urlParts = item.image_url.split('/item_images/');
        if (urlParts[1]) {
          await supabase.storage.from('item_images').remove([urlParts[1]]);
        }
      }

      const actionToast = {
        label: 'A la lista 🛒',
        onClick: async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { error: err } = await supabase.from('shopping_list').insert({
              pantry_id: item.pantry_id,
              name: item.name,
              added_by: user.id
            });
            if (err) throw err;
            toast.success(`"${item.name}" en tu lista de compra`);
          } catch (e) {
            toast.error('Error al añadir a la lista');
          }
        }
      };

      toast.success(`"${item.name}" eliminado`, {
        action: actionToast,
        duration: 6000
      });
      onDeleted();
    });
  };

  const hasImage = item.image_url && !imageError;

  return (
    <>
      <div
        className={`
          group relative glass-card rounded-xl border transition-all duration-300
          hover:scale-[1.01] hover:shadow-xl cursor-default
          ${colors.border} ${colors.bg}
          ${item.expiryStatus === 'critical' ? 'glow-red' : ''}
          ${item.expiryStatus === 'warning' ? 'glow-amber' : ''}
        `}
      >
        {/* Image */}
        {hasImage ? (
          <div className="relative h-32 rounded-t-xl overflow-hidden">
            <Image
              src={item.image_url!}
              alt={item.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            {/* Edit button on image hover */}
            <button
              id={`btn-edit-img-${item.id}`}
              onClick={() => setShowEditModal(true)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm"
              title="Editar producto"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="relative h-32 rounded-t-xl flex items-center justify-center bg-white/3 border-b border-white/5">
            <span className="text-3xl opacity-20">📷</span>
            {/* Edit button when no image */}
            <button
              id={`btn-edit-noimg-${item.id}`}
              onClick={() => setShowEditModal(true)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-white/10 text-muted-foreground hover:bg-white/20 hover:text-foreground"
              title="Editar producto"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-3 space-y-2">
          {/* Name + expiry badge */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm text-foreground leading-tight truncate flex-1">
              {item.name}
            </h3>
            <span
              className={`
                flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border
                ${colors.badge}
                ${item.expiryStatus === 'critical' || item.expiryStatus === 'expired' ? 'animate-pulse-soft' : ''}
              `}
            >
              {item.expiryStatus === 'expired' ? 'Caducado' : getExpiryLabel(item.daysUntilExpiry)}
            </span>
          </div>

          {/* Date */}
          <p className="text-[11px] text-muted-foreground">
            Caduca: <span className={`font-medium ${colors.text}`}>{formatDate(item.expiration_date)}</span>
          </p>

          {/* Quantity */}
          {item.quantity !== null && (
            <p className="text-[11px] text-muted-foreground">
              Cantidad: <span className="text-foreground/80 font-medium">{item.quantity} {item.unit ?? ''}</span>
            </p>
          )}

          {/* Notes */}
          {item.notes && (
            <p className="text-[11px] text-muted-foreground/70 italic truncate">
              {item.notes}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {/* Mark as consumed */}
            <button
              id={`btn-consume-${item.id}`}
              onClick={handleMarkConsumed}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all duration-150 disabled:opacity-50"
              title="Marcar como consumido"
            >
              {isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              Consumido
            </button>

            {/* Edit button */}
            <button
              id={`btn-edit-${item.id}`}
              onClick={() => setShowEditModal(true)}
              disabled={isPending}
              className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all duration-150 disabled:opacity-50"
              title="Editar producto"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            {/* Delete */}
            <AlertDialog>
              <AlertDialogTrigger
                id={`btn-delete-${item.id}`}
                disabled={isPending}
                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all duration-150 disabled:opacity-50"
                title="Eliminar producto"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#13131f] border-white/10">
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                    Se eliminará <strong className="text-foreground">"{item.name}"</strong> de tu inventario. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10">
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-500 text-white"
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Loading overlay */}
        {isPending && (
          <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center backdrop-blur-sm">
            <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <EditItemModal
        item={item}
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={onDeleted}
      />
    </>
  );
}
