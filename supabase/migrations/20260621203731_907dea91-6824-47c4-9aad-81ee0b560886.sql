
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tenant_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'instructor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'learner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mentor';
