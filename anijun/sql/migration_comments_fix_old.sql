UPDATE public.comments SET status = 'approved' WHERE status = 'pending';
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS user_verified BOOLEAN DEFAULT false;
