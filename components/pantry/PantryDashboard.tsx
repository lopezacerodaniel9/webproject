'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { GroupedItems, ItemCategory, PantryItemWithStatus, CATEGORY_ICONS, Pantry, UserPreferences } from '@/types/pantry';
import { getExpiryColorClasses } from '@/utils/dateUtils';
import CategoryGroup from './CategoryGroup';
import AddItemModal from './AddItemModal';
import SettingsModal from './SettingsModal';
import ShareModal from './ShareModal';
import ReceiptScannerModal from './ReceiptScannerModal';
import ReceiptHistoryModal from './ReceiptHistoryModal';
import ShoppingList from './ShoppingList';
import RecipeChefModal from './RecipeChefModal';
import StatsDashboard from './StatsDashboard';
import EmptyState from './EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  LogOut, ChefHat, Boxes, Plus, Menu, X, Search, Filter, 
  Trash2, AlertTriangle, AlertCircle, CheckCircle2, ChevronDown,
  Users, Edit, Camera, TrendingDown, Clock, Package, SlidersHorizontal, Settings, History,
  ShoppingCart, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type FilterStatus = 'all' | 'expired' | 'critical' | 'warning' | 'safe';

interface Props {
  grouped: GroupedItems[];
  userEmail: string;
  userPrefs: UserPreferences | null;
  activePantry: Pantry | null;
  pantries: Pantry[];
  stats: {
    totalItems: number;
    critical: number;
    expired: number;
    warning: number;
  };
}

export default function PantryDashboard({ grouped, userEmail, userPrefs, activePantry, pantries, stats }: Props) {
  const [activeModule, setActiveModule] = useState<'pantry' | 'shopping-list' | 'stats'>('pantry');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showChefModal, setShowChefModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const handleUpdate = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handleSwitchPantry = async (pantryId: string) => {
    if (!userPrefs) return;
    try {
      await supabase.from('user_preferences').upsert({
        user_id: userPrefs.user_id,
        active_pantry_id: pantryId,
      });
      handleUpdate();
    } catch (err) {
      toast.error('Error al cambiar de despensa');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Sesión cerrada');
    router.push('/login');
  };

  const handleItemAdded = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const userInitial = userEmail.charAt(0).toUpperCase();

  // ─── Filter logic (client-side, instant) ───
  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return grouped
      .map((group) => ({
        ...group,
        items: group.items.filter((item: PantryItemWithStatus) => {
          const matchesSearch = !query ||
            item.name.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query) ||
            (item.notes?.toLowerCase().includes(query) ?? false);

          const matchesStatus =
            filterStatus === 'all' ||
            item.expiryStatus === filterStatus;

          return matchesSearch && matchesStatus;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [grouped, searchQuery, filterStatus]);

  const hasActiveFilters = searchQuery.trim() !== '' || filterStatus !== 'all';
  const totalFiltered = filteredGroups.reduce((sum, g) => sum + g.items.length, 0);

  const filterOptions: { value: FilterStatus; label: string; color: string }[] = [
    { value: 'all', label: 'Todos', color: 'text-foreground' },
    { value: 'expired', label: 'Caducados', color: 'text-zinc-400' },
    { value: 'critical', label: 'Críticos (-3d)', color: 'text-red-400' },
    { value: 'warning', label: 'Aviso (3-7d)', color: 'text-amber-400' },
    { value: 'safe', label: 'En buen estado', color: 'text-emerald-400' },
  ];

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => {
    const displayName = userPrefs?.display_name || userEmail.split('@')[0];
    const initial = displayName.charAt(0).toUpperCase();

    return (
      <aside
        className={`
          flex flex-col h-full
          ${mobile ? 'w-full' : 'w-64'}
          bg-[#0d0d18] border-r border-white/5
        `}
      >
        {/* Logo */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center glow-violet">
              <ChefHat className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-white leading-tight">Asistente</p>
              <p className="text-xs text-muted-foreground">Personal</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400 hidden sm:block">
            Antigravity
          </h1>
          <button
            onClick={() => { setActiveModule('pantry'); if (mobile) setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeModule === 'pantry' ? 'bg-violet-600/15 text-violet-300' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
          >
            <Boxes className="w-4 h-4" />
            Inventario
          </button>
          <button
            onClick={() => { setActiveModule('shopping-list'); if (mobile) setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeModule === 'shopping-list' ? 'bg-indigo-600/15 text-indigo-300' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
          >
            <ShoppingCart className="w-4 h-4" />
            Lista de Compra
          </button>
          <button
            onClick={() => { setActiveModule('stats'); if (mobile) setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeModule === 'stats' ? 'bg-emerald-600/15 text-emerald-300' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
          >
            <BarChart3 className="w-4 h-4" />
            Finanzas
          </button>
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/5">
          <DropdownMenu>
            <DropdownMenuTrigger
              id="user-menu-trigger"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-violet-300 text-sm font-semibold flex-shrink-0 uppercase">
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#13131f] border-white/10">
              <DropdownMenuItem onClick={() => setShowSettingsModal(true)} className="text-muted-foreground cursor-pointer focus:bg-white/5">
                <Settings className="w-4 h-4 mr-2" />
                Ajustes de Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowShareModal(true)} className="text-muted-foreground cursor-pointer focus:bg-white/5">
                <Users className="w-4 h-4 mr-2" />
                Gestionar Despensa
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem
                id="btn-sign-out"
                onClick={handleSignOut}
                className="text-red-400 focus:text-red-300 focus:bg-red-950/30 cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    );
  };

  return (
    <div className="flex flex-col sm:flex-row h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 h-full animate-fade-in-up">
            <Sidebar mobile />
            <button
              id="close-mobile-sidebar"
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex-shrink-0 px-6 py-4 border-b border-white/5 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            <button
              id="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-muted-foreground hover:text-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <h1 className="text-xl font-bold text-foreground truncate max-w-[200px] sm:max-w-xs capitalize">
                {activeModule === 'pantry' ? 'Mi Despensa' : activeModule === 'stats' ? 'Estadísticas' : 'Lista de la Compra'}
              </h1>
              
              {activeModule === 'pantry' && (
                <p className="text-xs text-muted-foreground">
                  <span className="hidden sm:inline">• </span>
                  {stats.totalItems} {stats.totalItems === 1 ? 'producto' : 'productos'} en inventario
                </p>
              )}
            </div>

            {activeModule === 'pantry' && (
              <div className="flex gap-2">
              <Button
                id="btn-chef"
                onClick={() => setShowChefModal(true)}
                variant="outline"
                className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 rounded-xl gap-2 transition-all duration-200"
              >
                <ChefHat className="w-4 h-4" />
                <span className="hidden sm:inline">Chef IA</span>
              </Button>

              <Button
                id="btn-history"
                onClick={() => setShowHistoryModal(true)}
                variant="outline"
                className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300 rounded-xl gap-2 transition-all duration-200"
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Historial</span>
              </Button>

              <Button
                id="btn-scan-receipt"
                onClick={() => setShowReceiptModal(true)}
                variant="outline"
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 rounded-xl gap-2 transition-all duration-200"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Escanear Ticket</span>
              </Button>

              <Button
                id="btn-add-item"
                onClick={() => setShowAddModal(true)}
                className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-lg shadow-violet-900/30 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Añadir producto</span>
                <span className="sm:hidden">Añadir</span>
              </Button>
            </div>
            )}
          </div>

          {activeModule === 'pantry' && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {pantries.map((p) => {
              const isActive = p.id === activePantry?.id;
              const isPersonal = p.pantry_type === 'personal';
              return (
                <button
                  key={p.id}
                  onClick={() => handleSwitchPantry(p.id)}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                    ${isActive 
                      ? 'bg-violet-600/15 text-violet-300 border border-violet-500/20' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    {isPersonal ? <ChefHat className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    {p.name}
                  </div>
                </button>
              );
            })}
          </div>
          )}
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5 max-w-7xl mx-auto">
            {activeModule === 'shopping-list' ? (
              activePantry && <ShoppingList activePantryId={activePantry.id} />
            ) : activeModule === 'stats' ? (
              activePantry && <StatsDashboard activePantryId={activePantry.id} />
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                icon={Package}
                label="Total"
                value={stats.totalItems}
                colorClass="text-violet-400"
                bgClass="bg-violet-500/10 border-violet-500/20"
              />
              <StatCard
                icon={AlertTriangle}
                label="Caducados"
                value={stats.expired}
                colorClass="text-zinc-400"
                bgClass="bg-zinc-500/10 border-zinc-500/20"
              />
              <StatCard
                icon={TrendingDown}
                label="Críticos (-3d)"
                value={stats.critical}
                colorClass="text-red-400"
                bgClass="bg-red-500/10 border-red-500/20"
                pulse={stats.critical > 0}
              />
              <StatCard
                icon={Clock}
                label="Aviso (3-7d)"
                value={stats.warning}
                colorClass="text-amber-400"
                bgClass="bg-amber-500/10 border-amber-500/20"
              />
            </div>

            {/* Search + Filter bar */}
            {grouped.length > 0 && (
              <div className="flex gap-3 items-center">
                {/* Search input */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="search-input"
                    type="search"
                    placeholder="Buscar productos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-white/5 border-white/10 focus:border-violet-500/50 h-10 placeholder:text-muted-foreground/50"
                  />
                  {searchQuery && (
                    <button
                      id="btn-clear-search"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    id="btn-filter"
                    className={`
                      flex items-center gap-2 px-3 h-10 rounded-xl border text-sm font-medium transition-all
                      ${hasActiveFilters && filterStatus !== 'all'
                        ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                        : 'bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/8'
                      }
                    `}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {filterStatus === 'all' ? 'Filtrar' : filterOptions.find(f => f.value === filterStatus)?.label}
                    </span>
                    {filterStatus !== 'all' && (
                      <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                    )}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 bg-[#13131f] border-white/10">
                    <p className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
                      Filtrar por estado
                    </p>
                    <DropdownMenuSeparator className="bg-white/5" />
                    {filterOptions.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        id={`filter-${opt.value}`}
                        onClick={() => setFilterStatus(opt.value)}
                        className={`cursor-pointer ${opt.color} focus:bg-white/5`}
                      >
                        <span className="flex-1">{opt.label}</span>
                        {filterStatus === opt.value && (
                          <span className="w-2 h-2 rounded-full bg-violet-400" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Active filter summary */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Filter className="w-3 h-3" />
                <span>
                  Mostrando <strong className="text-foreground">{totalFiltered}</strong> de <strong className="text-foreground">{stats.totalItems}</strong> productos
                </span>
                <button
                  id="btn-clear-filters"
                  onClick={() => { setSearchQuery(''); setFilterStatus('all'); }}
                  className="text-violet-400 hover:text-violet-300 underline-offset-2 hover:underline transition-colors ml-1"
                >
                  Limpiar filtros
                </button>
              </div>
            )}

            {/* Inventory */}
            {grouped.length === 0 ? (
              <EmptyState onAddItem={() => setShowAddModal(true)} />
            ) : filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="w-12 h-12 text-muted-foreground/20 mb-4" />
                <h3 className="text-base font-semibold text-foreground/60 mb-2">Sin resultados</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ningún producto coincide con tu búsqueda o filtro.
                </p>
                <button
                  id="btn-clear-no-results"
                  onClick={() => { setSearchQuery(''); setFilterStatus('all'); }}
                  className="text-sm text-violet-400 hover:text-violet-300 underline-offset-2 hover:underline transition-colors"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredGroups.map((group, i) => (
                  <div
                    key={group.category}
                    className={`animate-fade-in-up stagger-${Math.min(i + 1, 5)}`}
                    style={{ opacity: 0 }}
                  >
                    <CategoryGroup
                      group={group}
                      onItemDeleted={handleItemAdded}
                    />
                  </div>
                ))}
              </div>
            )}
            </>
            )}
          </div>
        </div>
      </main>

      {/* Add Item Modal */}
      {activePantry && (
        <AddItemModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleItemAdded}
          activePantryId={activePantry.id}
        />
      )}

      <SettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        userPrefs={userPrefs}
        userEmail={userEmail}
        onUpdate={handleUpdate}
      />

      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        activePantry={activePantry}
        userPrefs={userPrefs}
        onUpdate={handleUpdate}
      />

      {activePantry && (
        <ReceiptScannerModal
          open={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          activePantryId={activePantry.id}
          onUpdate={handleUpdate}
        />
      )}

      {activePantry && (
        <ReceiptHistoryModal
          open={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          activePantryId={activePantry.id}
        />
      )}

      {activePantry && (
        <RecipeChefModal
          open={showChefModal}
          onClose={() => setShowChefModal(false)}
          pantryItems={grouped.flatMap(g => g.items)}
          activePantryId={activePantry.id}
        />
      )}
      
      {/* BOTTOM TAB BAR (Opción A) */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#13131f] border-t border-white/5 sm:hidden z-50 flex items-center justify-around px-2 py-3 pb-safe">
        <button 
          onClick={() => setActiveModule('pantry')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${activeModule === 'pantry' ? 'text-violet-400' : 'text-muted-foreground hover:text-white'}`}
        >
          <Boxes className={`w-6 h-6 mb-1 ${activeModule === 'pantry' ? 'fill-violet-400/20' : ''}`} />
          <span className="text-[10px] font-medium">Inventario</span>
        </button>

        <button 
          onClick={() => setActiveModule('shopping-list')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${activeModule === 'shopping-list' ? 'text-indigo-400' : 'text-muted-foreground hover:text-white'}`}
        >
          <ShoppingCart className={`w-6 h-6 mb-1 ${activeModule === 'shopping-list' ? 'fill-indigo-400/20' : ''}`} />
          <span className="text-[10px] font-medium">Compra</span>
        </button>

        <button 
          onClick={() => setActiveModule('stats')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${activeModule === 'stats' ? 'text-emerald-400' : 'text-muted-foreground hover:text-white'}`}
        >
          <BarChart3 className={`w-6 h-6 mb-1 ${activeModule === 'stats' ? 'fill-emerald-400/20' : ''}`} />
          <span className="text-[10px] font-medium">Finanzas</span>
        </button>

        <button 
          onClick={() => setShowSettingsModal(true)}
          className="flex flex-col items-center justify-center p-2 rounded-xl text-muted-foreground hover:text-white transition-all"
        >
          <Settings className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-medium">Ajustes</span>
        </button>
      </div>

      {/* Floating Settings Button (Desktop only now) */}
      <div className="fixed bottom-6 right-6 hidden sm:block">
        <Button
          onClick={() => setShowSettingsModal(true)}
          className="w-14 h-14 rounded-full bg-[#1a1a2e] border border-white/10 hover:bg-white/10 text-white shadow-2xl flex items-center justify-center transition-all hover:scale-105"
        >
          <Settings className="w-6 h-6 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  colorClass,
  bgClass,
  pulse = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  colorClass: string;
  bgClass: string;
  pulse?: boolean;
}) {
  return (
    <div className={`glass-card rounded-xl p-4 border ${bgClass} transition-all duration-200`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgClass}`}>
          <Icon className={`w-4 h-4 ${colorClass} ${pulse ? 'animate-pulse-soft' : ''}`} />
        </div>
        <div>
          <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}
