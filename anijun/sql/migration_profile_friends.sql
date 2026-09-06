-- ==========================================
-- AniJUN -- Profile Customization & Friends System
-- ==========================================

-- 1. Extend profiles table with customization and social fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_url TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#38bdf8';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#0ea5e9';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS border_radius TEXT DEFAULT '12px';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_background BOOLEAN DEFAULT true;

-- 2. Friends table with status
CREATE TABLE IF NOT EXISTS public.friends (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- Users can view their own friendships
DROP POLICY IF EXISTS "Users can view own friends" ON public.friends;
CREATE POLICY "Users can view own friends"
  ON public.friends FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can send friend requests
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friends;
CREATE POLICY "Users can send friend requests"
  ON public.friends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own friendships
DROP POLICY IF EXISTS "Users can update own friendships" ON public.friends;
CREATE POLICY "Users can update own friendships"
  ON public.friends FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can delete their own friendships
DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friends;
CREATE POLICY "Users can delete own friendships"
  ON public.friends FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_friends_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_friends_updated_at ON public.friends;
CREATE TRIGGER update_friends_updated_at
  BEFORE UPDATE ON public.friends
  FOR EACH ROW EXECUTE FUNCTION public.update_friends_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON public.friends(status);

-- 3. Function to check if two users are friends
CREATE OR REPLACE FUNCTION public.are_friends(user1 UUID, user2 UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friends
    WHERE ((user_id = user1 AND friend_id = user2) OR (user_id = user2 AND friend_id = user1))
      AND status = 'accepted'
  );
$$;

-- 4. Function to get friend list
CREATE OR REPLACE FUNCTION public.get_friends(target_user UUID)
RETURNS TABLE (
  friend_id UUID,
  username TEXT,
  avatar_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    CASE WHEN f.user_id = target_user THEN f.friend_id ELSE f.user_id END AS friend_id,
    p.username,
    p.avatar_url
  FROM public.friends f
  JOIN public.profiles p ON p.id = CASE WHEN f.user_id = target_user THEN f.friend_id ELSE f.user_id END
  WHERE (f.user_id = target_user OR f.friend_id = target_user)
    AND f.status = 'accepted'
  ORDER BY p.username;
$$;

-- 5. Function to get pending friend requests
CREATE OR REPLACE FUNCTION public.get_pending_requests(target_user UUID)
RETURNS TABLE (
  request_id BIGINT,
  user_id UUID,
  username TEXT,
  avatar_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    f.id AS request_id,
    f.user_id,
    p.username,
    p.avatar_url
  FROM public.friends f
  JOIN public.profiles p ON p.id = f.user_id
  WHERE f.friend_id = target_user
    AND f.status = 'pending'
  ORDER BY f.created_at DESC;
$$;