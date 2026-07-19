-- Función para obtener los miembros de una despensa (con sus nombres) de forma segura
CREATE OR REPLACE FUNCTION get_pantry_members_info(p_pantry_id UUID)
RETURNS TABLE (member_user_id UUID, member_role TEXT, member_display_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el usuario que ejecuta la función es miembro de la despensa
  IF NOT EXISTS (SELECT 1 FROM public.pantry_members WHERE pantry_id = p_pantry_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  RETURN QUERY
  SELECT 
    pm.user_id AS member_user_id, 
    pm.role AS member_role, 
    COALESCE(up.display_name, split_part(au.email, '@', 1)) AS member_display_name
  FROM public.pantry_members pm
  LEFT JOIN public.user_preferences up ON pm.user_id = up.user_id
  LEFT JOIN auth.users au ON pm.user_id = au.id
  WHERE pm.pantry_id = p_pantry_id;
END;
$$;
