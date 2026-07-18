-- 1. Arreglar la función join_pantry_by_code para que funcione si el usuario no tiene preferencias aún
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

  -- Cambiar su despensa activa a la nueva de forma segura (Upsert)
  INSERT INTO public.user_preferences (user_id, active_pantry_id)
  VALUES (auth.uid(), v_pantry_id)
  ON CONFLICT (user_id) DO UPDATE SET active_pantry_id = EXCLUDED.active_pantry_id;

  RETURN v_pantry_id;
END;
$$;

-- 2. Trigger para crear automáticamente una despensa cuando un usuario nuevo se registra
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  new_pantry_id UUID;
BEGIN
  new_pantry_id := gen_random_uuid();
  -- Insert default pantry
  INSERT INTO public.pantries (id, name, created_by) VALUES (new_pantry_id, 'Mi Despensa', NEW.id);
  -- Insert owner
  INSERT INTO public.pantry_members (pantry_id, user_id, role) VALUES (new_pantry_id, NEW.id, 'owner');
  -- Insert default preferences
  INSERT INTO public.user_preferences (user_id, active_pantry_id) VALUES (NEW.id, new_pantry_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si existe para recrearlo limpiamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Arreglar cualquier cuenta que se haya quedado huérfana (como la que acabas de crear)
DO $$
DECLARE
  rec RECORD;
  new_pantry_id UUID;
BEGIN
  FOR rec IN SELECT id as u_id FROM auth.users LOOP
    IF NOT EXISTS (SELECT 1 FROM public.pantry_members WHERE user_id = rec.u_id AND role = 'owner') THEN
      new_pantry_id := gen_random_uuid();
      INSERT INTO public.pantries (id, name, created_by) VALUES (new_pantry_id, 'Mi Despensa', rec.u_id);
      INSERT INTO public.pantry_members (pantry_id, user_id, role) VALUES (new_pantry_id, rec.u_id, 'owner');
      
      INSERT INTO public.user_preferences (user_id, active_pantry_id) 
      VALUES (rec.u_id, new_pantry_id)
      ON CONFLICT (user_id) DO UPDATE SET active_pantry_id = EXCLUDED.active_pantry_id WHERE public.user_preferences.active_pantry_id IS NULL;
    END IF;
  END LOOP;
END $$;
