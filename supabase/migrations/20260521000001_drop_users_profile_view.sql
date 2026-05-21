-- Drop the unused users_profile view.
-- It was defined with SECURITY DEFINER, which bypasses RLS and allows
-- any authenticated user to read all rows in public.users via the REST API.
-- Nothing in the codebase queries this view, so dropping it is safe.

DROP VIEW IF EXISTS public.users_profile;
