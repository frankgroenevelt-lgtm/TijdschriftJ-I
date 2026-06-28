-- =============================================================
--  E-mailveld vervalt: het formulier vraagt geen e-mailadres meer.
-- =============================================================
alter table public.submissions drop column if exists email;
