-- Migration 008: Character profile customization
-- Adds profile columns and creates avatars storage bucket

-- ============================================================
-- PROFILE COLUMNS
-- ============================================================
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS title text DEFAULT '';
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS bio text DEFAULT '';
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS profile_color text DEFAULT '#c04e20';

-- ============================================================
-- STORAGE BUCKET: avatars
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE RLS: allow authenticated users to upload/manage own avatars
-- ============================================================
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- UPDATE PROFILE RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_profile(
  p_character_id uuid,
  p_title text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_profile_color text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE public.characters
  SET
    title = COALESCE(p_title, title),
    bio = COALESCE(p_bio, bio),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    profile_color = COALESCE(p_profile_color, profile_color)
  WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
