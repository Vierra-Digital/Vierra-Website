-- Track the last editorial update of a blog post, for schema.org `dateModified`
-- (content freshness). Nullable: existing rows stay NULL and fall back to
-- `published_date` until the post is next edited.
ALTER TABLE "blog_posts" ADD COLUMN "updated_date" TIMESTAMP(6);
