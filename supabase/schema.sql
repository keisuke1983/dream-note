create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dreams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  reason text,
  deadline date,
  category text,
  desired_state text,
  status text not null default 'active',
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  dream_id uuid references public.dreams(id) on delete set null,
  parent_goal_id uuid references public.goals(id) on delete set null,
  title text not null,
  description text,
  level text not null,
  deadline date,
  status text not null default 'todo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  dream_id uuid references public.dreams(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  title text not null,
  memo text,
  due_date date,
  urgent boolean not null default false,
  important boolean not null default true,
  status text not null default 'todo',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.goals
  add column if not exists parent_goal_id uuid references public.goals(id) on delete set null;

create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  memo text,
  kind text not null default 'idea',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  dream_id uuid references public.dreams(id) on delete set null,
  input_snapshot jsonb not null,
  output_json jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.today_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  suggestion_date date not null,
  context_hash text not null,
  input_snapshot jsonb not null,
  output_json jsonb not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_ai_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  week_start date not null,
  week_end date not null,
  context_hash text not null,
  input_snapshot jsonb not null,
  output_json jsonb not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  reflection_date date not null,
  done_text text,
  not_done_text text,
  dream_progress_text text,
  tomorrow_text text,
  insight_text text,
  satisfaction_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, reflection_date)
);

alter table public.profiles enable row level security;
alter table public.dreams enable row level security;
alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.inbox_items enable row level security;
alter table public.ai_suggestions enable row level security;
alter table public.today_ai_suggestions enable row level security;
alter table public.weekly_ai_reviews enable row level security;
alter table public.daily_reflections enable row level security;

create policy "profiles owner access" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "dreams owner access" on public.dreams
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "goals owner access" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tasks owner access" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "inbox items owner access" on public.inbox_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "ai suggestions owner access" on public.ai_suggestions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "today ai suggestions owner access" on public.today_ai_suggestions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "weekly ai reviews owner access" on public.weekly_ai_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "daily reflections owner access" on public.daily_reflections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
