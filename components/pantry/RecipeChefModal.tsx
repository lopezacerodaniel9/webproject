'use client';

import { useState, useEffect } from 'react';
import { ChefHat, X, Flame, Scale, Wand2, Clock, BarChart, Plus, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PantryItemWithStatus } from '@/types/pantry';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

interface Recipe {
  type: 'urgency' | 'balanced' | 'creative';
  title: string;
  description: string;
  difficulty: string;
  time: string;
  ingredientsUsed: string[];
  extraIngredient: string | null;
  steps: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  pantryItems: PantryItemWithStatus[];
  activePantryId: string;
}

export default function RecipeChefModal({ open, onClose, pantryItems, activePantryId }: Props) {
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRecipe, setExpandedRecipe] = useState<number | null>(null);
  const [addedExtras, setAddedExtras] = useState<Record<number, boolean>>({});

  const supabase = createClient();

  useEffect(() => {
    if (open && !recipes && !loading) {
      generateRecipes();
    }
  }, [open]);

  const generateRecipes = async () => {
    setLoading(true);
    setError(null);
    setRecipes(null);
    setExpandedRecipe(null);
    setAddedExtras({});

    try {
      const response = await fetch('/api/generate-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: pantryItems }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al generar recetas');
      }

      setRecipes(data.recipes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExtra = async (recipeIdx: number, extraName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autorizado');

      const { error } = await supabase.from('shopping_list').insert({
        pantry_id: activePantryId,
        name: extraName,
        added_by: user.id
      });

      if (error) throw error;
      
      setAddedExtras(prev => ({ ...prev, [recipeIdx]: true }));
      toast.success(`"${extraName}" añadido a la lista de la compra 🛒`);
    } catch (err) {
      toast.error('Error al añadir a la lista');
    }
  };

  if (!open) return null;

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'urgency':
        return { icon: Flame, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Urgencia Máxima' };
      case 'balanced':
        return { icon: Scale, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Equilibrada' };
      case 'creative':
        return { icon: Wand2, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30', label: 'Imaginación Libre' };
      default:
        return { icon: ChefHat, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', label: 'Sugerencia' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm sm:backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full sm:w-[600px] h-[90vh] sm:h-auto sm:max-h-[85vh] bg-[#0f0f16] sm:rounded-3xl border-t sm:border border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300 relative overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0 relative bg-gradient-to-r from-violet-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center glow-violet">
              <ChefHat className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Chef IA</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Te sugiero recetas con lo que tienes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-violet-500/20 rounded-full blur-xl animate-pulse"></div>
                <ChefHat className="w-16 h-16 text-violet-400 relative animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-foreground">El Chef está pensando...</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Analizando tu despensa y buscando las mejores combinaciones para ti.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center space-y-4">
              <Flame className="w-12 h-12 text-red-400 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-red-400 mb-1">¡Ups! Algo se quemó</h3>
                <p className="text-sm text-red-400/80">{error}</p>
              </div>
              <Button onClick={generateRecipes} variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/20">
                Intentar de nuevo
              </Button>
            </div>
          )}

          {recipes && (
            <div className="space-y-4 pb-10">
              {recipes.map((recipe, idx) => {
                const info = getTypeInfo(recipe.type);
                const Icon = info.icon;
                const isExpanded = expandedRecipe === idx;

                return (
                  <div 
                    key={idx} 
                    className={`rounded-2xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'bg-white/[0.03] border-white/10 shadow-xl' : 'bg-[#13131f] border-white/5 hover:border-white/10'}`}
                  >
                    {/* Card Header (Clickable) */}
                    <div 
                      className="p-4 cursor-pointer flex gap-4"
                      onClick={() => setExpandedRecipe(isExpanded ? null : idx)}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${info.bg} ${info.border} border`}>
                        <Icon className={`w-6 h-6 ${info.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] uppercase font-bold tracking-wider ${info.color}`}>
                            {info.label}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-foreground leading-tight mb-1">
                          {recipe.title}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {recipe.description}
                        </p>
                        
                        {/* Meta */}
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            {recipe.time}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <BarChart className="w-3.5 h-3.5" />
                            {recipe.difficulty}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center shrink-0 text-muted-foreground/50">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 animate-in slide-in-from-top-4 duration-300">
                        <div className="border-t border-white/5 pt-4 space-y-5">
                          
                          {/* Ingredients */}
                          <div>
                            <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                              Ingredientes de tu despensa
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                              {recipe.ingredientsUsed.map((ing, i) => (
                                <span key={i} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground">
                                  {ing}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Extra Ingredient (Si existe) */}
                          {recipe.extraIngredient && (
                            <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <h4 className="text-xs font-bold text-violet-300 uppercase tracking-wider mb-0.5">
                                  Toque Extra (Opcional)
                                </h4>
                                <p className="text-sm text-violet-100">
                                  {recipe.extraIngredient}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleAddExtra(idx, recipe.extraIngredient!); }}
                                disabled={addedExtras[idx]}
                                className={`shrink-0 h-8 text-xs ${addedExtras[idx] ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-violet-600 hover:bg-violet-500 text-white'}`}
                              >
                                {addedExtras[idx] ? (
                                  <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> En la lista</>
                                ) : (
                                  <><Plus className="w-3.5 h-3.5 mr-1.5" /> Añadir a lista</>
                                )}
                              </Button>
                            </div>
                          )}

                          {/* Steps */}
                          <div>
                            <h4 className="text-sm font-bold text-foreground mb-3">Pasos</h4>
                            <div className="space-y-3">
                              {recipe.steps.map((step, i) => (
                                <div key={i} className="flex gap-3">
                                  <div className="w-6 h-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                                    {i + 1}
                                  </div>
                                  <p className="text-sm text-muted-foreground/90 pt-0.5 leading-relaxed">
                                    {step}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              <div className="pt-4 flex justify-center">
                <Button 
                  variant="outline" 
                  onClick={generateRecipes}
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-muted-foreground gap-2"
                >
                  <Wand2 className="w-4 h-4" />
                  Generar otras recetas
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
