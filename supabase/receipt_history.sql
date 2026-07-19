-- =====================================================
-- MIGRACIÓN: HISTORIAL DE TICKETS (RECEIPTS)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pantry_id UUID NOT NULL REFERENCES public.pantries(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_spent NUMERIC(10,2) NOT NULL DEFAULT 0,
  items_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Ver: los miembros de la despensa pueden ver los tickets
DROP POLICY IF EXISTS "receipts: select members" ON public.receipts;
CREATE POLICY "receipts: select members" ON public.receipts FOR SELECT
USING (EXISTS (SELECT 1 FROM public.pantry_members WHERE pantry_id = receipts.pantry_id AND user_id = auth.uid()));

-- Insertar: los miembros de la despensa pueden insertar tickets
DROP POLICY IF EXISTS "receipts: insert members" ON public.receipts;
CREATE POLICY "receipts: insert members" ON public.receipts FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.pantry_members WHERE pantry_id = receipts.pantry_id AND user_id = auth.uid()));

-- No permitimos UPDATE o DELETE por ahora (los tickets son inmutables histórico)
