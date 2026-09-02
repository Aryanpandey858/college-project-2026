-- ==============================================================================
-- AI-Powered Real-Time Surveillance & Incident Detection Platform
-- Database Schema, Realtime Replication, and Storage Bucket Setup
-- ==============================================================================

-- 1. Create Incidents Table
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('COMBAT', 'WEAPON', 'ACCIDENT', 'CUSTOM')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    snapshot_url TEXT NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    live_token VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Indexes for High-Speed Realtime Dashboard Queries
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON public.incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON public.incidents (type);
CREATE INDEX IF NOT EXISTS idx_incidents_recipient_email ON public.incidents (recipient_email);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access so operators can view incidents on the live dashboard
CREATE POLICY "Allow public read access to incidents"
    ON public.incidents
    FOR SELECT
    USING (true);

-- Allow service role full access (Next.js serverless API routes write here)
CREATE POLICY "Allow service role full access to incidents"
    ON public.incidents
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- 4. Enable Supabase Realtime for Zero-Refresh Dashboard Streaming
-- Note: Requires publication membership in Supabase PostgreSQL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'incidents'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
    END IF;
END $$;

-- 5. Storage Bucket Setup: incident-snapshots
-- Ensure public bucket exists for storing incident evidence snapshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'incident-snapshots',
    'incident-snapshots',
    true,
    5242880, -- 5 MB limit per snapshot
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 6. Storage Security Policies for incident-snapshots
-- Allow public viewing of evidence photos (embedded in recipient emails)
CREATE POLICY "Allow public view for incident snapshots"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'incident-snapshots');

-- Allow service role / authenticated uploads from Next.js backend
CREATE POLICY "Allow serverless upload for incident snapshots"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'incident-snapshots');
