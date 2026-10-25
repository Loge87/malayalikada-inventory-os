-- Product type (Frozen / Dry) as a pricing factor.
--
-- products.product_type: nullable so existing products keep working; a
-- product with no type only picks up price variables that apply to "all".
-- price_variables.applies_to_type: which products a variable is applied to
-- when a price formula is evaluated. 'all' (default) keeps every existing
-- variable behaving exactly as before.

alter table public.products
  add column if not exists product_type text
  check (product_type in ('frozen', 'dry'));

alter table public.price_variables
  add column if not exists applies_to_type text not null default 'all'
  check (applies_to_type in ('all', 'frozen', 'dry'));
