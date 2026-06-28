import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover_url: string;
  audio_url: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const SETUP_SQL = `
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Create tracks table
CREATE TABLE IF NOT EXISTS tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text NOT NULL,
  album text NOT NULL DEFAULT '',
  duration integer NOT NULL DEFAULT 0,
  cover_url text NOT NULL DEFAULT '',
  audio_url text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth required)
DROP POLICY IF EXISTS "allow_select_tracks" ON tracks;
CREATE POLICY "allow_select_tracks" ON tracks FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "allow_insert_tracks" ON tracks;
CREATE POLICY "allow_insert_tracks" ON tracks FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "allow_update_tracks" ON tracks;
CREATE POLICY "allow_update_tracks" ON tracks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_delete_tracks" ON tracks;
CREATE POLICY "allow_delete_tracks" ON tracks FOR DELETE TO anon, authenticated USING (true);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_tracks_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tracks_updated_at ON tracks;
CREATE TRIGGER tracks_updated_at BEFORE UPDATE ON tracks FOR EACH ROW EXECUTE FUNCTION update_tracks_updated_at();

-- Create storage bucket for media
INSERT INTO storage.buckets (id, name, public) VALUES ('tracks-media', 'tracks-media', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "public_read_tracks_media" ON storage.objects;
CREATE POLICY "public_read_tracks_media" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'tracks-media');

DROP POLICY IF EXISTS "public_upload_tracks_media" ON storage.objects;
CREATE POLICY "public_upload_tracks_media" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'tracks-media');

DROP POLICY IF EXISTS "public_update_tracks_media" ON storage.objects;
CREATE POLICY "public_update_tracks_media" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'tracks-media');

DROP POLICY IF EXISTS "public_delete_tracks_media" ON storage.objects;
CREATE POLICY "public_delete_tracks_media" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'tracks-media');

-- Insert sample tracks
INSERT INTO tracks (title, artist, album, duration, cover_url, sort_order) VALUES
  ('Midnight Dreams', 'Luna Echo', 'Neon Nights', 245, 'https://images.pexels.com/photos/3407617/pexels-photo-3407617.jpeg?auto=compress&cs=tinysrgb&w=400', 1),
  ('Electric Soul', 'Neon Pulse', 'Synthwave', 198, 'https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg?auto=compress&cs=tinysrgb&w=400', 2),
  ('Crystalline', 'Aurora Wave', 'Digital Dreams', 267, 'https://images.pexels.com/photos/3545857/pexels-photo-3545857.jpeg?auto=compress&cs=tinysrgb&w=400', 3),
  ('Echoes of Tomorrow', 'Stellar Core', 'Cosmic Journey', 223, 'https://images.pexels.com/photos/3721941/pexels-photo-3721941.jpeg?auto=compress&cs=tinysrgb&w=400', 4),
  ('Velvet Horizon', 'Midnight Rider', 'Dusk to Dawn', 211, 'https://images.pexels.com/photos/3670171/pexels-photo-3670171.jpeg?auto=compress&cs=tinysrgb&w=400', 5),
  ('Infinite Pulse', 'Cyber Wave', 'Digital Renaissance', 254, 'https://images.pexels.com/photos/3631514/pexels-photo-3631514.jpeg?auto=compress&cs=tinysrgb&w=400', 6),
  ('Luminescence', 'Temporal Drift', 'Future Echoes', 189, 'https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg?auto=compress&cs=tinysrgb&w=400', 7),
  ('Stardust Symphony', 'Cosmic Strings', 'Nebula Tales', 278, 'https://images.pexels.com/photos/3545857/pexels-photo-3545857.jpeg?auto=compress&cs=tinysrgb&w=400', 8)
ON CONFLICT DO NOTHING;
`.trim();
