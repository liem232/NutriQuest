
-- 1. Fix RLS policies: Drop all RESTRICTIVE policies and recreate as PERMISSIVE

-- food_diary policies
DROP POLICY IF EXISTS "Users can view own diary" ON public.food_diary;
DROP POLICY IF EXISTS "Admins can view all diaries" ON public.food_diary;
DROP POLICY IF EXISTS "Users can insert own diary" ON public.food_diary;
DROP POLICY IF EXISTS "Users can update own diary" ON public.food_diary;
DROP POLICY IF EXISTS "Users can delete own diary" ON public.food_diary;

CREATE POLICY "Users can view own diary" ON public.food_diary FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all diaries" ON public.food_diary FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own diary" ON public.food_diary FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own diary" ON public.food_diary FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own diary" ON public.food_diary FOR DELETE USING (auth.uid() = user_id);

-- profiles policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- achievements policies
DROP POLICY IF EXISTS "Anyone can view achievements" ON public.achievements;
DROP POLICY IF EXISTS "Admins can manage achievements" ON public.achievements;

CREATE POLICY "Anyone can view achievements" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "Admins can manage achievements" ON public.achievements FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- user_achievements policies
DROP POLICY IF EXISTS "Anyone can view user achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "System can insert achievements" ON public.user_achievements;

CREATE POLICY "Anyone can view user achievements" ON public.user_achievements FOR SELECT USING (true);
CREATE POLICY "System can insert achievements" ON public.user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- products policies
DROP POLICY IF EXISTS "Anyone can view approved products" ON public.products;
DROP POLICY IF EXISTS "Admins can manage all products" ON public.products;
DROP POLICY IF EXISTS "Users can add products" ON public.products;

CREATE POLICY "Anyone can view approved products" ON public.products FOR SELECT USING (is_approved = true OR added_by = auth.uid());
CREATE POLICY "Admins can manage all products" ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can add products" ON public.products FOR INSERT WITH CHECK (auth.uid() = added_by);

-- product_categories policies
DROP POLICY IF EXISTS "Anyone can view categories" ON public.product_categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON public.product_categories;

CREATE POLICY "Anyone can view categories" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.product_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- user_roles policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 2. Create handle_new_user trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Add best_streak and is_blocked to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

-- 4. Create titles table
CREATE TABLE IF NOT EXISTS public.titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_days integer NOT NULL,
  max_days integer,
  icon text DEFAULT '🏆',
  color text DEFAULT '#8B5CF6',
  is_admin_title boolean NOT NULL DEFAULT false
);
ALTER TABLE public.titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view titles" ON public.titles FOR SELECT USING (true);
CREATE POLICY "Admins can manage titles" ON public.titles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 5. Create daily_stats table
CREATE TABLE IF NOT EXISTS public.daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  total_calories integer NOT NULL DEFAULT 0,
  total_protein numeric(6,2) NOT NULL DEFAULT 0,
  total_fat numeric(6,2) NOT NULL DEFAULT 0,
  total_carbs numeric(6,2) NOT NULL DEFAULT 0,
  goal_achieved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own stats" ON public.daily_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stats" ON public.daily_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stats" ON public.daily_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all stats" ON public.daily_stats FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 6. Create recommendations table
CREATE TABLE IF NOT EXISTS public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  icon text DEFAULT '💡',
  trigger_type text NOT NULL,
  trigger_value text,
  modal_content text,
  products text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active recommendations" ON public.recommendations FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage recommendations" ON public.recommendations FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 7. Update handle_new_user to also set best_streak
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
