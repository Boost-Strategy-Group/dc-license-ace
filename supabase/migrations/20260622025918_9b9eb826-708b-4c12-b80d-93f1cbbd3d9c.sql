
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(coalesce(NEW.email, ''));
  v_role  app_role := 'student';
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  IF v_email = 'jackie@boost.test' THEN
    v_role := 'super_admin';
  ELSIF v_email = 'admin@boost.test' THEN
    v_role := 'tenant_admin';
  ELSIF v_email = 'learner@boost.test' THEN
    v_role := 'learner';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
