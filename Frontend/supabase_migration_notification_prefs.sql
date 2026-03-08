-- Optional: add notification preference columns to profiles so they can be synced across devices.
-- Run this in your Supabase SQL editor if you want to persist in-app and email reminder preferences.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_data TEXT,
  ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notification_in_app BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notification_email BOOLEAN DEFAULT FALSE;

-- Allow users to insert their own profile row (upsert needs INSERT).
DO $$
BEGIN
  CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Log table to prevent sending duplicate daily digests.
CREATE TABLE IF NOT EXISTS public.reminder_email_sends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  sent_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS reminder_email_sends_unique
  ON public.reminder_email_sends (user_id, sent_date);

ALTER TABLE public.reminder_email_sends ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can view own reminder sends" ON public.reminder_email_sends
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
