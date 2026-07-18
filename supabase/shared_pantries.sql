-- =====================================================
-- MIGRACIÓN: DESPENSAS COMPARTIDAS Y PERFIL DE USUARIO
-- =====================================================

-- 1. Crear tabla de despensas (pantries)
CREATE TABLE IF NOT EXISTS public.pantries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Mi Despensa',
  share_code UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Crear tabla de miembros (pantry_members)
CREATE TABLE IF NOT EXISTS public.pantry_members (
  pantry_id UUID REFERENCES public.pantries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'member'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pantry_id, user_id)
);

-- 3. Modificar tablas existentes
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS active_pantry_id UUID REFERENCES public.pantries(id) ON DELETE SET NULL;

ALTER TABLE public.pantry_items ADD COLUMN IF NOT EXISTS pantry_id UUID REFERENCES public.pantries(id) ON DELETE CASCADE;

-- Renombrar user_id a added_by de forma segura (por si el script se ejecuta varias veces)
DO $$
BEGIN
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='pantry_items' AND column_name='user_id') THEN
      ALTER TABLE public.pantry_items RENAME COLUMN user_id TO added_by;
  END IF;
END $$;

-- 4. Migrar Datos Existentes
DO $$
DECLARE
  rec RECORD;
  new_pantry_id UUID;
BEGIN
  -- Recorrer todos los usuarios registrados
  FOR rec IN SELECT id as u_id FROM auth.users LOOP
    -- Comprobar si el usuario ya tiene una despensa (para ser idempotente)
    IF NOT EXISTS (SELECT 1 FROM public.pantry_members WHERE user_id = rec.u_id AND role = 'owner') THEN
      -- Crear despensa principal del usuario
      new_pantry_id := gen_random_uuid();
      INSERT INTO public.pantries (id, name, created_by) VALUES (new_pantry_id, 'Mi Despensa', rec.u_id);
      
      -- Añadir al usuario como dueño
      INSERT INTO public.pantry_members (pantry_id, user_id, role) VALUES (new_pantry_id, rec.u_id, 'owner');
      
      -- Asignar todos sus items actuales a esta nueva despensa
      UPDATE public.pantry_items SET pantry_id = new_pantry_id WHERE added_by = rec.u_id AND pantry_id IS NULL;
      
      -- Guardar esta despensa como su despensa activa actual
      -- Primero asegurar que tenga row en user_preferences
      INSERT INTO public.user_preferences (user_id, active_pantry_id) 
      VALUES (rec.u_id, new_pantry_id)
      ON CONFLICT (user_id) DO UPDATE SET active_pantry_id = EXCLUDED.active_pantry_id WHERE public.user_preferences.active_pantry_id IS NULL;
    END IF;
  END LOOP;
END $$;

-- Ahora que todos los items tienen despensa, lo hacemos obligatorio
ALTER TABLE public.pantry_items ALTER COLUMN pantry_id SET NOT NULL;

-- 5. Configurar RLS (Row Level Security)
ALTER TABLE public.pantries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_members ENABLE ROW LEVEL SECURITY;

-- Pantries: Los usuarios solo pueden ver las despensas a las que pertenecen
CREATE POLICY "pantries: select members" ON public.pantries FOR SELECT
USING (EXISTS (SELECT 1 FROM public.pantry_members WHERE pantry_id = id AND user_id = auth.uid()));

CREATE POLICY "pantries: update owners" ON public.pantries FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.pantry_members WHERE pantry_id = id AND user_id = auth.uid() AND role = 'owner'));

CREATE POLICY "pantries: insert authenticated" ON public.pantries FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- Pantry Members: Ver miembros de mis despensas
CREATE POLICY "pantry_members: select shared" ON public.pantry_members FOR SELECT
USING (EXISTS (SELECT 1 FROM public.pantry_members pm WHERE pm.pantry_id = pantry_members.pantry_id AND pm.user_id = auth.uid()));

CREATE POLICY "pantry_members: insert own owner" ON public.pantry_members FOR INSERT
WITH CHECK (user_id = auth.uid() AND role = 'owner' AND EXISTS (SELECT 1 FROM public.pantries WHERE id = pantry_id AND created_by = auth.uid()));

-- Eliminar políticas antiguas de pantry_items
DROP POLICY IF EXISTS "pantry_items: select own active" ON public.pantry_items;
DROP POLICY IF EXISTS "pantry_items: insert own" ON public.pantry_items;
DROP POLICY IF EXISTS "pantry_items: update own" ON public.pantry_items;
DROP POLICY IF EXISTS "pantry_items: delete own" ON public.pantry_items;

-- Nuevas políticas de pantry_items basadas en pantry_id
CREATE POLICY "pantry_items: select members" ON public.pantry_items FOR SELECT
USING (EXISTS (SELECT 1 FROM public.pantry_members WHERE pantry_id = pantry_items.pantry_id AND user_id = auth.uid()));

CREATE POLICY "pantry_items: insert members" ON public.pantry_items FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.pantry_members WHERE pantry_id = pantry_items.pantry_id AND user_id = auth.uid()));

CREATE POLICY "pantry_items: update members" ON public.pantry_items FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.pantry_members WHERE pantry_id = pantry_items.pantry_id AND user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.pantry_members WHERE pantry_id = pantry_items.pantry_id AND user_id = auth.uid()));

CREATE POLICY "pantry_items: delete members" ON public.pantry_items FOR DELETE
USING (EXISTS (SELECT 1 FROM public.pantry_members WHERE pantry_id = pantry_items.pantry_id AND user_id = auth.uid()));

-- 6. RPC (Función) para unirse a una despensa mediante código secreto
CREATE OR REPLACE FUNCTION join_pantry_by_code(p_share_code UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pantry_id UUID;
BEGIN
  -- Buscar la despensa
  SELECT id INTO v_pantry_id FROM public.pantries WHERE share_code = p_share_code;
  
  IF v_pantry_id IS NULL THEN
    RAISE EXCEPTION 'Código inválido o despensa no encontrada';
  END IF;

  -- Insertar como miembro (ignorar si ya está)
  INSERT INTO public.pantry_members (pantry_id, user_id, role)
  VALUES (v_pantry_id, auth.uid(), 'member')
  ON CONFLICT (pantry_id, user_id) DO NOTHING;

  -- Cambiar su despensa activa a la nueva
  UPDATE public.user_preferences SET active_pantry_id = v_pantry_id WHERE user_id = auth.uid();

  RETURN v_pantry_id;
END;
$$;
