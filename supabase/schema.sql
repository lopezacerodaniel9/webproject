-- =====================================================
-- ASISTENTE PERSONAL MODULAR
-- Módulo 1: Control de Inventario y Caducidades
-- =====================================================
-- Ejecutar en: Supabase SQL Editor
-- =====================================================

-- ─────────────────────────────────────────────
-- 1. TABLA PRINCIPAL: pantry_items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pantry_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  category        TEXT        NOT NULL DEFAULT 'Otros',
  quantity        NUMERIC(10,2),
  unit            TEXT,                         -- 'kg', 'g', 'L', 'ml', 'unidades', etc.
  expiration_date DATE        NOT NULL,
  image_url       TEXT,
  notes           TEXT,
  deleted_at      TIMESTAMPTZ,                  -- soft delete (NULL = activo)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_pantry_items_user_id
  ON public.pantry_items(user_id);

CREATE INDEX IF NOT EXISTS idx_pantry_items_expiration
  ON public.pantry_items(expiration_date);

CREATE INDEX IF NOT EXISTS idx_pantry_items_user_active
  ON public.pantry_items(user_id, deleted_at)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────
-- 2. TABLA: user_preferences (placeholder modular)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id                 UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_expiry_days      INTEGER     DEFAULT 3,       -- días antes de caducidad para notificar
  notify_email            BOOLEAN     DEFAULT FALSE,
  theme                   TEXT        DEFAULT 'dark',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 3. FUNCIÓN: auto-actualizar updated_at
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pantry_items_updated_at
  BEFORE UPDATE ON public.pantry_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────

-- Habilitar RLS
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- ─── Políticas para pantry_items ───

-- SELECT: solo filas propias y no eliminadas
CREATE POLICY "pantry_items: select own active"
  ON public.pantry_items
  FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- INSERT: solo con user_id propio
CREATE POLICY "pantry_items: insert own"
  ON public.pantry_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: solo filas propias
CREATE POLICY "pantry_items: update own"
  ON public.pantry_items
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE (físico, no usado por defecto - usamos soft delete vía UPDATE)
CREATE POLICY "pantry_items: delete own"
  ON public.pantry_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Políticas para user_preferences ───

CREATE POLICY "user_preferences: select own"
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_preferences: insert own"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences: update own"
  ON public.user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 5. SUPABASE STORAGE: Bucket item_images
-- ─────────────────────────────────────────────

-- Crear bucket (ejecutar desde SQL Editor)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item_images',
  'item_images',
  true,                               -- público (URLs accesibles sin auth)
  5242880,                            -- 5 MB máximo por archivo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Política Storage: cualquier usuario autenticado puede SUBIR (INSERT)
CREATE POLICY "item_images: authenticated users can upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'item_images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Política Storage: el usuario solo puede actualizar sus propias imágenes
CREATE POLICY "item_images: owner can update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'item_images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Política Storage: el usuario solo puede eliminar sus propias imágenes
CREATE POLICY "item_images: owner can delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'item_images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Política Storage: cualquiera puede VER imágenes (bucket público)
CREATE POLICY "item_images: public read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'item_images');
