-- Migration 007: Drop unused appearance column
ALTER TABLE public.characters DROP COLUMN IF EXISTS appearance;
