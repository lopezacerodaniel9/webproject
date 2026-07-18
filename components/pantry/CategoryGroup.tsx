'use client';

import { GroupedItems, CATEGORY_ICONS } from '@/types/pantry';
import ItemCard from './ItemCard';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface Props {
  group: GroupedItems;
  onItemDeleted: () => void;
}

export default function CategoryGroup({ group, onItemDeleted }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const icon = CATEGORY_ICONS[group.category] ?? '📦';

  const criticalCount = group.items.filter((i) => i.expiryStatus === 'critical' || i.expiryStatus === 'expired').length;

  return (
    <div className="space-y-3">
      {/* Category Header */}
      <button
        id={`category-toggle-${group.category.replace(/\s+/g, '-').toLowerCase()}`}
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 group"
      >
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xl">{icon}</span>
          <h2 className="text-sm font-bold text-foreground/80 group-hover:text-foreground transition-colors uppercase tracking-widest">
            {group.category}
          </h2>
          <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
            {group.items.length}
          </span>
          {criticalCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse-soft">
              {criticalCount} urgente{criticalCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Items Grid */}
      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {group.items.map((item, i) => (
            <div
              key={item.id}
              className={`animate-fade-in-up stagger-${Math.min(i + 1, 5)}`}
              style={{ opacity: 0 }}
            >
              <ItemCard item={item} onDeleted={onItemDeleted} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
