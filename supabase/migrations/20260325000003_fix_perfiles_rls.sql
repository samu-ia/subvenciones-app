-- Fix infinite recursion in perfil_admin_all RLS policy
-- The policy was querying perfiles from within perfiles causing infinite recursion.
-- Solution: SECURITY DEFINER function that bypasses RLS to check the user's role.

CREATE OR REPLACE FUNCTION public.get_my_rol()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM public.perfiles WHERE id = auth.uid()
$$;

-- Drop the recursive policy and recreate it using the function
DROP POLICY IF EXISTS perfil_admin_all ON public.perfiles;

CREATE POLICY perfil_admin_all ON public.perfiles
  FOR ALL USING (
    public.get_my_rol() = 'admin'
  );
