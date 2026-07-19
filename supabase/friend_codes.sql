-- 1. Añadir código de invitación al perfil del usuario
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS invite_code UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;

-- 2. Añadir tipo de despensa ('personal' o 'shared')
ALTER TABLE public.pantries ADD COLUMN IF NOT EXISTS pantry_type TEXT NOT NULL DEFAULT 'personal';

-- 3. Actualizar despensas existentes a 'personal' (o 'shared' si tienen más de 1 miembro)
UPDATE public.pantries 
SET pantry_type = 'shared'
WHERE id IN (
  SELECT pantry_id 
  FROM public.pantry_members 
  GROUP BY pantry_id 
  HAVING count(*) > 1
);

-- 4. Nuevo RPC: Crear despensa compartida por código de amigo
CREATE OR REPLACE FUNCTION create_shared_pantry_by_code(p_friend_code UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_friend_id UUID;
  v_new_pantry_id UUID;
BEGIN
  -- Buscar al usuario dueño del código
  SELECT user_id INTO v_friend_id 
  FROM public.user_preferences 
  WHERE invite_code = p_friend_code;
  
  IF v_friend_id IS NULL THEN
    RAISE EXCEPTION 'Código de amigo inválido o no encontrado';
  END IF;

  IF v_friend_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes invitarte a ti mismo';
  END IF;

  -- Comprobar si ya existe una despensa compartida exactamente entre estos dos usuarios
  -- (Opcional, pero buena práctica para evitar duplicados infinitos)
  SELECT p.id INTO v_new_pantry_id
  FROM public.pantries p
  JOIN public.pantry_members m1 ON p.id = m1.pantry_id
  JOIN public.pantry_members m2 ON p.id = m2.pantry_id
  WHERE p.pantry_type = 'shared'
    AND m1.user_id = auth.uid()
    AND m2.user_id = v_friend_id;

  IF v_new_pantry_id IS NOT NULL THEN
    -- Ya existe una despensa compartida entre ambos, simplemente la marcamos como activa
    UPDATE public.user_preferences SET active_pantry_id = v_new_pantry_id WHERE user_id = auth.uid();
    RETURN v_new_pantry_id;
  END IF;

  -- Crear nueva despensa compartida
  v_new_pantry_id := gen_random_uuid();
  INSERT INTO public.pantries (id, name, created_by, pantry_type) 
  VALUES (v_new_pantry_id, 'Despensa Compartida', auth.uid(), 'shared');

  -- Insertar a ambos como miembros (dueños ambos, o el creador owner y el otro member)
  INSERT INTO public.pantry_members (pantry_id, user_id, role) VALUES (v_new_pantry_id, auth.uid(), 'owner');
  INSERT INTO public.pantry_members (pantry_id, user_id, role) VALUES (v_new_pantry_id, v_friend_id, 'owner');

  -- Cambiar la despensa activa del usuario que introduce el código a esta nueva
  UPDATE public.user_preferences SET active_pantry_id = v_new_pantry_id WHERE user_id = auth.uid();

  RETURN v_new_pantry_id;
END;
$$;
