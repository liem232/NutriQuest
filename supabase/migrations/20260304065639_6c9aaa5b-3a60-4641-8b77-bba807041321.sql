
-- Enum for activity levels
CREATE TYPE public.activity_level AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');

-- Enum for gender
CREATE TYPE public.gender_type AS ENUM ('male', 'female');

-- Enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Enum for meal types
CREATE TYPE public.meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  gender gender_type NOT NULL DEFAULT 'male',
  age INTEGER NOT NULL DEFAULT 25 CHECK (age >= 14 AND age <= 100),
  weight NUMERIC(5,1) NOT NULL DEFAULT 70 CHECK (weight >= 30 AND weight <= 250),
  height NUMERIC(5,1) NOT NULL DEFAULT 175 CHECK (height >= 120 AND height <= 220),
  activity_level activity_level NOT NULL DEFAULT 'moderate',
  goal TEXT NOT NULL DEFAULT 'maintain' CHECK (goal IN ('lose', 'maintain', 'gain')),
  daily_calories INTEGER NOT NULL DEFAULT 2200,
  protein_goal INTEGER NOT NULL DEFAULT 120,
  fat_goal INTEGER NOT NULL DEFAULT 70,
  carbs_goal INTEGER NOT NULL DEFAULT 250,
  streak_days INTEGER NOT NULL DEFAULT 0,
  total_days INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  title TEXT NOT NULL DEFAULT 'Новичок',
  xp INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- PRODUCT CATEGORIES
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage categories" ON public.product_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.product_categories(id),
  calories_per_100g NUMERIC(6,1) NOT NULL CHECK (calories_per_100g >= 0),
  protein_per_100g NUMERIC(5,1) NOT NULL DEFAULT 0 CHECK (protein_per_100g >= 0),
  fat_per_100g NUMERIC(5,1) NOT NULL DEFAULT 0 CHECK (fat_per_100g >= 0),
  carbs_per_100g NUMERIC(5,1) NOT NULL DEFAULT 0 CHECK (carbs_per_100g >= 0),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view approved products" ON public.products FOR SELECT TO authenticated USING (is_approved = true OR added_by = auth.uid());
CREATE POLICY "Users can add products" ON public.products FOR INSERT TO authenticated WITH CHECK (auth.uid() = added_by);
CREATE POLICY "Admins can manage all products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- FOOD DIARY
CREATE TABLE public.food_diary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  meal meal_type NOT NULL,
  grams NUMERIC(6,1) NOT NULL CHECK (grams > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.food_diary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own diary" ON public.food_diary FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own diary" ON public.food_diary FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own diary" ON public.food_diary FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own diary" ON public.food_diary FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all diaries" ON public.food_diary FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_food_diary_user_date ON public.food_diary(user_id, date);

-- ACHIEVEMENTS
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏆',
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL DEFAULT 1,
  xp_reward INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view achievements" ON public.achievements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage achievements" ON public.achievements FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- USER ACHIEVEMENTS
CREATE TABLE public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view user achievements" ON public.user_achievements FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert achievements" ON public.user_achievements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- FUNCTIONS & TRIGGERS

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Calculate daily calories function
CREATE OR REPLACE FUNCTION public.calculate_daily_calories(
  p_weight NUMERIC, p_height NUMERIC, p_age INTEGER, p_gender gender_type, p_activity activity_level, p_goal TEXT
)
RETURNS TABLE(calories INTEGER, protein INTEGER, fat INTEGER, carbs INTEGER)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  bmr NUMERIC;
  tdee NUMERIC;
  multiplier NUMERIC;
  goal_adj NUMERIC;
BEGIN
  IF p_gender = 'male' THEN
    bmr := 10 * p_weight + 6.25 * p_height - 5 * p_age + 5;
  ELSE
    bmr := 10 * p_weight + 6.25 * p_height - 5 * p_age - 161;
  END IF;

  CASE p_activity
    WHEN 'sedentary' THEN multiplier := 1.2;
    WHEN 'light' THEN multiplier := 1.375;
    WHEN 'moderate' THEN multiplier := 1.55;
    WHEN 'active' THEN multiplier := 1.725;
    WHEN 'very_active' THEN multiplier := 1.9;
  END CASE;

  CASE p_goal
    WHEN 'lose' THEN goal_adj := 0.85;
    WHEN 'gain' THEN goal_adj := 1.15;
    ELSE goal_adj := 1.0;
  END CASE;

  tdee := ROUND(bmr * multiplier * goal_adj);
  
  calories := tdee::INTEGER;
  protein := ROUND(tdee * 0.30 / 4)::INTEGER;
  fat := ROUND(tdee * 0.25 / 9)::INTEGER;
  carbs := ROUND(tdee * 0.45 / 4)::INTEGER;
  
  RETURN NEXT;
END;
$$;
