-- Pin search_path on the three functions the Supabase advisor flags (0011
-- function_search_path_mutable). Behaviour is unchanged; every table reference in them is
-- already schema-qualified or in public.
-- builder_layers_touch is also covered by 20261020090000 (PR #24, not applied to prod); this
-- repeats it so either can be applied first.
-- NOT applied to prod: needs Patrick's OK.
alter function public.prevent_last_admin_demotion() set search_path = public, pg_temp;
alter function public.ambassador_is_minor(text) set search_path = public, pg_temp;
alter function public.builder_layers_touch() set search_path = public, pg_temp;
