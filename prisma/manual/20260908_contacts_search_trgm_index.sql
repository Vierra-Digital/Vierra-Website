-- GET /api/contacts does a case-insensitive `contains` match across first_name, last_name, email,
-- and business on every keystroke (client-debounced). Only company_id/user_id are indexed today, so
-- this is a sequential scan of the whole contacts table per search — fine at current volume, but it
-- degrades linearly as a company's contact list grows.
--
-- pg_trgm's GIN index accelerates ILIKE '%term%' (and the LIKE/regex operators Prisma's
-- `contains`+`insensitive` compiles to) without requiring the search term to be a prefix.
--
-- Not reflected in schema.prisma: a trigram opclass index needs Prisma's `extendedIndexes` preview
-- feature, and this project deliberately omits it (see the generator's `previewFeatures` comment) —
-- the index exists in the database only, same as the other GIN/trigram indexes already applied this
-- way. This does not affect correctness; it only means `prisma db pull`/`validate` won't see it.
--
-- CONCURRENTLY so this doesn't take a table lock on a live table; can't run inside a transaction,
-- so this file must be applied as its own statement (not batched with other migrations).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_contacts_search_trgm"
  ON "contacts"
  USING GIN (
    (coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || email || ' ' || coalesce(business, ''))
    gin_trgm_ops
  );
