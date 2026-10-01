-- G-ui-t schema. GitHub holds files, branches, commits and PRs;
-- these tables hold app metadata and drive realtime updates.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  github_login text unique not null,
  name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- provider_token is only returned at sign-in, so we keep it here.
create table public.github_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  name text not null,
  description text,
  type text not null check (type in ('prototype', 'website', 'blank')),
  repo_owner text not null,
  repo_name text not null,
  default_branch text not null default 'main',
  current_sha text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  github_login text not null check (github_login = lower(github_login)),
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  invited_by uuid not null references public.profiles,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, github_login)
);

create table public.changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  author_id uuid not null references public.profiles,
  title text not null,
  description text,
  branch text not null,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'changes_requested', 'merged', 'closed')),
  pr_number int,
  changed_files text[] not null default '{}',
  merge_sha text,
  merged_at timestamptz,
  merged_by uuid references public.profiles,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.review_requests (
  change_id uuid not null references public.changes on delete cascade,
  reviewer_id uuid not null references public.profiles,
  state text not null default 'waiting' check (state in ('waiting', 'approved', 'changes_requested')),
  updated_at timestamptz not null default now(),
  primary key (change_id, reviewer_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  change_id uuid not null references public.changes on delete cascade,
  author_id uuid not null references public.profiles,
  body text not null,
  pin_x real check (pin_x between 0 and 1),
  pin_y real check (pin_y between 0 and 1),
  viewport text,
  created_at timestamptz not null default now()
);

create table public.activity (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects on delete cascade,
  actor_id uuid not null references public.profiles,
  kind text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index on public.changes (project_id, status);
create index on public.activity (project_id, created_at desc);
create index on public.comments (change_id, created_at);

-- Helpers (security definer so policies don't recurse through project_members).
create function public.is_member(p uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from project_members where project_id = p and user_id = auth.uid())
$$;

create function public.my_login() returns text
language sql security definer stable set search_path = public as $$
  select lower(github_login) from profiles where id = auth.uid()
$$;

create function public.change_project(c uuid) returns uuid
language sql security definer stable set search_path = public as $$
  select project_id from changes where id = c
$$;

alter table public.profiles enable row level security;
alter table public.github_tokens enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.invites enable row level security;
alter table public.changes enable row level security;
alter table public.review_requests enable row level security;
alter table public.comments enable row level security;
alter table public.activity enable row level security;

create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create policy "own token" on public.github_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "members or invitees read projects" on public.projects for select to authenticated
  using (owner_id = auth.uid() or is_member(id)
    or exists (select 1 from invites i where i.project_id = projects.id and i.github_login = my_login()));
create policy "create own projects" on public.projects for insert to authenticated with check (owner_id = auth.uid());
create policy "members update projects" on public.projects for update to authenticated using (is_member(id));

create policy "members read members" on public.project_members for select to authenticated
  using (is_member(project_id) or user_id = auth.uid());
create policy "owner adds members, invitees join" on public.project_members for insert to authenticated
  with check (
    exists (select 1 from projects p where p.id = project_id and p.owner_id = auth.uid())
    or (user_id = auth.uid() and exists (
      select 1 from invites i where i.project_id = project_members.project_id
        and i.github_login = my_login() and i.role = project_members.role))
  );

create policy "members or invitee read invites" on public.invites for select to authenticated
  using (is_member(project_id) or github_login = my_login());
create policy "members invite" on public.invites for insert to authenticated
  with check (is_member(project_id) and invited_by = auth.uid());
create policy "invitee accepts" on public.invites for update to authenticated
  using (github_login = my_login() or is_member(project_id));

create policy "members read changes" on public.changes for select to authenticated using (is_member(project_id));
create policy "members start changes" on public.changes for insert to authenticated
  with check (is_member(project_id) and author_id = auth.uid());
create policy "members update changes" on public.changes for update to authenticated using (is_member(project_id));

create policy "members read reviews" on public.review_requests for select to authenticated
  using (is_member(change_project(change_id)));
create policy "members write reviews" on public.review_requests for insert to authenticated
  with check (is_member(change_project(change_id)));
create policy "members update reviews" on public.review_requests for update to authenticated
  using (is_member(change_project(change_id)));

create policy "members read comments" on public.comments for select to authenticated
  using (is_member(change_project(change_id)));
create policy "members comment" on public.comments for insert to authenticated
  with check (is_member(change_project(change_id)) and author_id = auth.uid());

create policy "members read activity" on public.activity for select to authenticated using (is_member(project_id));
create policy "members log activity" on public.activity for insert to authenticated
  with check (is_member(project_id) and actor_id = auth.uid());

alter publication supabase_realtime add table public.activity, public.changes, public.comments, public.review_requests;
