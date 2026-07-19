-- =====================================================
-- MIGRACIÓN: LISTA DE LA COMPRA
-- =====================================================

CREATE TABLE IF NOT EXISTS public.shopping_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pantry_id UUID NOT NULL REFERENCES public.pantries(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  is_checked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para updated_at (asume que la función handle_updated_at ya existe del init.sql/schema.sql)
CREATE TRIGGER shopping_list_updated_at
  BEFORE UPDATE ON public.shopping_list
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;

-- Ver: los miembros de la despensa pueden ver la lista
DROP POLICY IF EXISTS "shopping_list: select members" ON public.shopping_list;
CREATE POLICY "shopping_list: select members" ON public.shopping_list FOR SELECT
USING (EXISTS (SELECT 1 FROM public.pantry_members WHERE pantry_id = shopping_list.pantry_id AND user_id = auth.uid()));

-- Insertar: los miembros de la despensa pueden añadir cosas a la lista
DROP POLICY IF EXISTS "shopping_list: insert members" ON public.shopping_list;
CREATE POLICY "shopping_list: insert members" ON public.shopping_list FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.pantry_members WHERE pantry_id = shopping_list.pantry_id AND user_id = auth.uid()));

-- Actualizar: los miembros pueden tachar o modificar cosas de la lista
DROP POLICY IF EXISTS "shopping_list: update members" ON public.shopping_list;
CREATE POLICY "shopping_list: update members" ON public.shopping_list FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.pantry_members WHERE pantry_id = shopping_list.pantry_id AND user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.pantry_members WHERE pantry_id = shopping_list.pantry_id AND user_id = auth.uid()));

-- Eliminar: los miembros pueden borrar cosas de la lista (vaciar tachados)
DROP POLICY IF EXISTS "shopping_list: delete members" ON public.shopping_list;
CREATE POLICY "shopping_list: delete members" ON public.shopping_list FOR DELETE
USING (EXISTS (SELECT 1 FROM public.pantry_members WHERE pantry_id = shopping_list.pantry_id AND user_id = auth.uid()));
