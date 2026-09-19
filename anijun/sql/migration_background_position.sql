ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_pos_x INT DEFAULT 50;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_pos_y INT DEFAULT 50;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_zoom INT DEFAULT 100;
