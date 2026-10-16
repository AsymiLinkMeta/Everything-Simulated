-- Pin the search_path of the builder_layers updated_at trigger (Supabase advisor 0011 function_search_path_mutable).
ALTER FUNCTION public.builder_layers_touch() SET search_path = public, pg_temp;
