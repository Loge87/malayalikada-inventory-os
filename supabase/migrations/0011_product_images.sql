-- Product images: a product-level image (shared across its variants), stored
-- in a private Supabase Storage bucket, one folder per organisation.
--
-- products.image_url stores the STORAGE OBJECT PATH (e.g.
-- '<organisation_id>/<uuid>.jpg'), not a public URL — the bucket is private,
-- so there is no stable public URL to store. The app resolves this path to a
-- short-lived signed URL when rendering (createSignedUrl / createSignedUrls),
-- which itself requires the caller to pass the SELECT policy below.

alter table public.products
  add column image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  false,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Objects are keyed '<organisation_id>/...', so the first path segment is the
-- owning organisation. storage.objects already has RLS enabled by default in
-- Supabase; these policies are additive.
create policy "org members can view their product images"
  on storage.objects for select
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1]::uuid in (select user_org_ids())
  );

create policy "org members can upload their product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1]::uuid in (select user_org_ids())
  );

create policy "org members can update their product images"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1]::uuid in (select user_org_ids())
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1]::uuid in (select user_org_ids())
  );

create policy "org members can delete their product images"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1]::uuid in (select user_org_ids())
  );

------------------------------------------------------------------------------
-- create_product_with_variant gains p_brand (products.brand is now exposed
-- in the unified create form, alongside name/category). Adding a parameter
-- needs DROP + CREATE, not CREATE OR REPLACE — same reasoning as 0005/0006/
-- 0008: the function is only ever called by name via RPC, so this is safe.
------------------------------------------------------------------------------
drop function if exists public.create_product_with_variant(
  uuid, text, text, text, text, text, text, text, numeric, numeric, numeric, uuid, numeric
);

create function public.create_product_with_variant(
  p_organisation_id uuid,
  p_product_name text,
  p_category text,
  p_brand text,
  p_variant_name text,
  p_sku text,
  p_barcode text,
  p_unit text,
  p_currency text,
  p_pack_price numeric,
  p_units_per_pack numeric,
  p_unit_price numeric,
  p_initial_location_id uuid default null,
  p_initial_quantity numeric default null
)
returns uuid
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_product_id uuid;
begin
  insert into public.products (organisation_id, name, category, brand)
  values (p_organisation_id, p_product_name, p_category, p_brand)
  returning id into v_product_id;

  return public.create_product_variant(
    p_organisation_id, v_product_id, p_variant_name, p_sku, p_barcode, p_unit,
    p_currency, p_pack_price, p_units_per_pack, p_unit_price,
    p_initial_location_id, p_initial_quantity
  );
end;
$$;
