-- Rollback for scripts/data/remove-trak-racer-names.sql: restores every changed row from the
-- _backup_20261104_trak_* tables that script created.
begin;
update public.catalog_products c set name = b.name, brand = b.brand, image = b.image, description = b.description,
  notes = b.notes, updated_at = b.updated_at
  from public._backup_20261104_trak_products b where b.id = c.id;
update public.prebuilds p set blurb = b.blurb, description = b.description, specs = b.specs, highlights = b.highlights
  from public._backup_20261104_trak_prebuilds b where b.id = p.id;
update public.compatibility_rules r set reason = b.reason
  from public._backup_20261104_trak_rules b where b.id = r.id;
update public.agent_playbooks a set body = b.body
  from public._backup_20261104_trak_playbooks b where b.id = a.id;
insert into public.brands select * from public._backup_20261104_trak_brands on conflict (id) do nothing;
commit;
