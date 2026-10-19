-- =============================================================================
-- Byspolyhub — run this ONCE in the Supabase SQL Editor
-- Project: https://uucwfokbycoifllfuanz.supabase.co
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------- tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  username text unique not null,
  student_id text,
  department text,
  level text,
  role text not null default 'student' check (role in ('student','staff','alumni','admin')),
  bio text not null default '',
  avatar_url text,
  cover_url text,
  is_verified boolean not null default false,
  is_banned boolean not null default false,
  ban_reason text,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text not null default '',
  cover_url text,
  category text not null default 'Department',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  image_url text,
  is_announcement boolean not null default false,
  is_pinned boolean not null default false,
  group_id uuid references public.groups(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  image_url text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('going','maybe','declined')),
  primary key (event_id, user_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('user','post','comment')),
  target_id uuid not null,
  reason text not null,
  details text not null default '',
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_by uuid references public.profiles(id),
  resolution text
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_id uuid,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_group_idx on public.posts (group_id, created_at desc);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists profiles_username_idx on public.profiles (username);

-- ---------- helpers ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_banned = false
  );
$$;

create or replace function public.is_not_banned()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_banned = false
  );
$$;

create or replace function public.is_group_manager(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role in ('owner','admin')
  );
$$;

-- Auto-create profile on signup. Only two emails become admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text;
  assigned text;
  verified boolean := false;
  uname text;
begin
  requested := coalesce(new.raw_user_meta_data->>'role', 'student');
  if requested not in ('student','staff','alumni') then
    requested := 'student';
  end if;
  assigned := requested;
  if lower(new.email) in ('admin@byspolyhub.github.io', 'admin2@byspolyhub.github.io') then
    assigned := 'admin';
    verified := true;
  end if;
  uname := regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g');
  if length(uname) < 2 then uname := 'member'; end if;
  insert into public.profiles (
    id, email, full_name, username, student_id, department, level, role, bio, is_verified
  ) values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), uname),
    uname || '-' || substr(replace(new.id::text, '-', ''), 1, 6),
    nullif(new.raw_user_meta_data->>'student_id',''),
    nullif(new.raw_user_meta_data->>'department',''),
    nullif(new.raw_user_meta_data->>'level',''),
    assigned,
    '',
    verified
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any auth users created before this script ran.
insert into public.profiles (
  id, email, full_name, username, student_id, department, level, role, bio, is_verified
)
select
  u.id,
  u.email,
  coalesce(nullif(u.raw_user_meta_data->>'full_name',''), split_part(u.email, '@', 1)),
  regexp_replace(split_part(u.email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g') || '-' || substr(replace(u.id::text, '-', ''), 1, 6),
  nullif(u.raw_user_meta_data->>'student_id',''),
  nullif(u.raw_user_meta_data->>'department',''),
  nullif(u.raw_user_meta_data->>'level',''),
  case
    when lower(u.email) in ('admin@byspolyhub.github.io', 'admin2@byspolyhub.github.io') then 'admin'
    when coalesce(u.raw_user_meta_data->>'role','student') in ('student','staff','alumni') then coalesce(u.raw_user_meta_data->>'role','student')
    else 'student'
  end,
  '',
  lower(u.email) in ('admin@byspolyhub.github.io', 'admin2@byspolyhub.github.io')
from auth.users u
where u.email is not null
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

drop policy if exists "groups read" on public.groups;
create policy "groups read" on public.groups for select using (true);
drop policy if exists "groups insert" on public.groups;
create policy "groups insert" on public.groups for insert with check (auth.uid() = created_by and public.is_not_banned());
drop policy if exists "groups update" on public.groups;
create policy "groups update" on public.groups for update using (
  public.is_admin()
  or created_by = auth.uid()
  or exists (
    select 1 from public.group_members m
    where m.group_id = id and m.user_id = auth.uid() and m.role in ('owner','admin')
  )
);
drop policy if exists "groups delete" on public.groups;
create policy "groups delete" on public.groups for delete using (
  public.is_admin()
  or exists (
    select 1 from public.group_members m
    where m.group_id = id and m.user_id = auth.uid() and m.role in ('owner','admin')
  )
);

drop policy if exists "group members read" on public.group_members;
create policy "group members read" on public.group_members for select using (true);
drop policy if exists "group members insert" on public.group_members;
create policy "group members insert" on public.group_members for insert with check (auth.uid() = user_id and public.is_not_banned());
drop policy if exists "group members delete" on public.group_members;
create policy "group members delete" on public.group_members for delete using (
  auth.uid() = user_id
  or public.is_admin()
  or public.is_group_manager(group_id)
);

drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select using (true);
drop policy if exists "posts insert" on public.posts;
create policy "posts insert" on public.posts
  for insert with check (
    auth.uid() = author_id
    and public.is_not_banned()
    and (is_announcement = false or public.is_admin())
  );
drop policy if exists "posts update" on public.posts;
create policy "posts update" on public.posts for update using (author_id = auth.uid() or public.is_admin());
drop policy if exists "posts delete" on public.posts;
create policy "posts delete" on public.posts for delete using (author_id = auth.uid() or public.is_admin());

drop policy if exists "likes read" on public.post_likes;
create policy "likes read" on public.post_likes for select using (true);
drop policy if exists "likes insert" on public.post_likes;
create policy "likes insert" on public.post_likes for insert with check (auth.uid() = user_id and public.is_not_banned());
drop policy if exists "likes delete" on public.post_likes;
create policy "likes delete" on public.post_likes for delete using (auth.uid() = user_id or public.is_admin());

drop policy if exists "comments read" on public.post_comments;
create policy "comments read" on public.post_comments for select using (true);
drop policy if exists "comments insert" on public.post_comments;
create policy "comments insert" on public.post_comments for insert with check (auth.uid() = author_id and public.is_not_banned());
drop policy if exists "comments delete" on public.post_comments;
create policy "comments delete" on public.post_comments for delete using (author_id = auth.uid() or public.is_admin());

drop policy if exists "events read" on public.events;
create policy "events read" on public.events for select using (true);
drop policy if exists "events insert" on public.events;
create policy "events insert" on public.events for insert with check (auth.uid() = created_by and public.is_not_banned());
drop policy if exists "events update" on public.events;
create policy "events update" on public.events for update using (created_by = auth.uid() or public.is_admin());
drop policy if exists "events delete" on public.events;
create policy "events delete" on public.events for delete using (created_by = auth.uid() or public.is_admin());

drop policy if exists "rsvp read" on public.event_rsvps;
create policy "rsvp read" on public.event_rsvps for select using (true);
drop policy if exists "rsvp upsert" on public.event_rsvps;
create policy "rsvp upsert" on public.event_rsvps for insert with check (auth.uid() = user_id and public.is_not_banned());
drop policy if exists "rsvp update" on public.event_rsvps;
create policy "rsvp update" on public.event_rsvps for update using (auth.uid() = user_id);
drop policy if exists "rsvp delete" on public.event_rsvps;
create policy "rsvp delete" on public.event_rsvps for delete using (auth.uid() = user_id);

drop policy if exists "conv read" on public.conversations;
create policy "conv read" on public.conversations for select using (
  public.is_admin() or exists (
    select 1 from public.conversation_members m
    where m.conversation_id = id and m.user_id = auth.uid()
  )
);
drop policy if exists "conv insert" on public.conversations;
create policy "conv insert" on public.conversations for insert with check (auth.uid() is not null and public.is_not_banned());

drop policy if exists "conv members read" on public.conversation_members;
create policy "conv members read" on public.conversation_members for select using (
  public.is_admin() or user_id = auth.uid() or exists (
    select 1 from public.conversation_members m
    where m.conversation_id = conversation_id and m.user_id = auth.uid()
  )
);
drop policy if exists "conv members insert" on public.conversation_members;
create policy "conv members insert" on public.conversation_members for insert with check (public.is_not_banned());

drop policy if exists "messages read" on public.messages;
create policy "messages read" on public.messages for select using (
  public.is_admin() or exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id and m.user_id = auth.uid()
  )
);
drop policy if exists "messages insert" on public.messages;
create policy "messages insert" on public.messages for insert with check (
  auth.uid() = sender_id and public.is_not_banned() and exists (
    select 1 from public.conversation_members m
    where m.conversation_id = conversation_id and m.user_id = auth.uid()
  )
);
drop policy if exists "messages update" on public.messages;
create policy "messages update" on public.messages for update using (
  exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id and m.user_id = auth.uid()
  )
);

drop policy if exists "reports insert" on public.reports;
create policy "reports insert" on public.reports for insert with check (auth.uid() = reporter_id and public.is_not_banned());
drop policy if exists "reports read" on public.reports;
create policy "reports read" on public.reports for select using (public.is_admin() or reporter_id = auth.uid());
drop policy if exists "reports update" on public.reports;
create policy "reports update" on public.reports for update using (public.is_admin());

drop policy if exists "notifs read" on public.notifications;
create policy "notifs read" on public.notifications for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "notifs insert" on public.notifications;
create policy "notifs insert" on public.notifications for insert with check (public.is_not_banned());
drop policy if exists "notifs update" on public.notifications;
create policy "notifs update" on public.notifications for update using (user_id = auth.uid());

-- ---------- storage ----------
insert into storage.buckets (id, name, public)
values ('avatars','avatars', true), ('posts','posts', true), ('covers','covers', true)
on conflict (id) do nothing;

drop policy if exists "public read media" on storage.objects;
create policy "public read media" on storage.objects
  for select using (bucket_id in ('avatars','posts','covers'));

drop policy if exists "auth upload media" on storage.objects;
create policy "auth upload media" on storage.objects
  for insert with check (
    bucket_id in ('avatars','posts','covers')
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own update media" on storage.objects;
create policy "own update media" on storage.objects
  for update using (
    bucket_id in ('avatars','posts','covers')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own delete media" on storage.objects;
create policy "own delete media" on storage.objects
  for delete using (
    bucket_id in ('avatars','posts','covers')
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ---------- realtime ----------
alter table public.messages replica identity full;
alter table public.notifications replica identity full;
alter table public.posts replica identity full;

do $$
begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.posts; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.post_likes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.post_comments; exception when duplicate_object then null; end;
end $$;

-- ---------- extended social + CMS ----------
alter table public.site_settings add column if not exists images jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists is_muted boolean not null default false;
alter table public.profiles add column if not exists revoked_at timestamptz;
alter table public.posts add column if not exists media jsonb not null default '[]'::jsonb;
alter table public.post_comments add column if not exists parent_id uuid references public.post_comments(id) on delete cascade;

create table if not exists public.reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  primary key (post_id, user_id)
);
create table if not exists public.saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);
create table if not exists public.comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (comment_id, user_id)
);
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now()
);
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.site_pages (
  slug text primary key,
  title text not null,
  body text not null default '',
  updated_at timestamptz not null default now()
);
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  body text not null default '',
  cover_url text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  maintenance boolean not null default false,
  maintenance_message text not null default '',
  hero_image text,
  rector_image text,
  images jsonb not null default '{}'::jsonb
);
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('avatar','username','full_name','bio','story','media')),
  at timestamptz not null default now()
);

insert into public.site_pages (slug, title, body)
values
  ('about', 'About Byspolyhub', 'Byspolyhub is the official social hub for Bayelsa State Polytechnic, Aleibiri.'),
  ('privacy', 'Privacy Policy', 'Account details are stored so the campus hub can function. We do not sell personal information.'),
  ('guidelines', 'Community Guidelines', 'No harassment, hate, impersonation or academic misconduct. Three strikes lead to a restriction.')
on conflict (slug) do nothing;

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

create or replace function public.enforce_usage()
returns trigger language plpgsql as $$
declare n int; maxn int; win interval;
begin
  if new.kind = 'avatar' then maxn := 3; win := interval '30 days';
  elsif new.kind = 'username' then maxn := 2; win := interval '30 days';
  elsif new.kind = 'full_name' then maxn := 1; win := interval '30 days';
  elsif new.kind = 'bio' then maxn := 5; win := interval '30 days';
  elsif new.kind = 'story' then maxn := 8; win := interval '1 day';
  elsif new.kind = 'media' then maxn := 12; win := interval '1 day';
  else raise exception 'Unknown usage kind';
  end if;
  select count(*) into n from public.usage_events
    where user_id = new.user_id and kind = new.kind and at > now() - win;
  if n >= maxn then
    raise exception 'Usage limit reached for %', new.kind;
  end if;
  return new;
end $$;

drop trigger if exists usage_limit on public.usage_events;
create trigger usage_limit before insert on public.usage_events
  for each row execute function public.enforce_usage();

alter table public.reactions enable row level security;
alter table public.saves enable row level security;
alter table public.comment_likes enable row level security;
alter table public.follows enable row level security;
alter table public.friendships enable row level security;
alter table public.stories enable row level security;
alter table public.activity_logs enable row level security;
alter table public.site_pages enable row level security;
alter table public.articles enable row level security;
alter table public.site_settings enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists "reactions all" on public.reactions;
create policy "reactions read" on public.reactions for select using (true);
create policy "reactions write" on public.reactions for insert with check (auth.uid() = user_id);
create policy "reactions del" on public.reactions for delete using (auth.uid() = user_id or public.is_admin());
drop policy if exists "saves read" on public.saves;
create policy "saves read" on public.saves for select using (auth.uid() = user_id or public.is_admin());
create policy "saves write" on public.saves for insert with check (auth.uid() = user_id);
create policy "saves del" on public.saves for delete using (auth.uid() = user_id);
drop policy if exists "clikes read" on public.comment_likes;
create policy "clikes read" on public.comment_likes for select using (true);
create policy "clikes write" on public.comment_likes for insert with check (auth.uid() = user_id);
create policy "clikes del" on public.comment_likes for delete using (auth.uid() = user_id or public.is_admin());
drop policy if exists "follows read" on public.follows;
create policy "follows read" on public.follows for select using (true);
create policy "follows write" on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows del" on public.follows for delete using (auth.uid() = follower_id);
drop policy if exists "friends read" on public.friendships;
create policy "friends read" on public.friendships for select using (auth.uid() = requester_id or auth.uid() = addressee_id or public.is_admin());
create policy "friends insert" on public.friendships for insert with check (auth.uid() = requester_id);
create policy "friends update" on public.friendships for update using (auth.uid() = addressee_id or public.is_admin());
drop policy if exists "stories read" on public.stories;
create policy "stories read" on public.stories for select using (true);
create policy "stories insert" on public.stories for insert with check (auth.uid() = author_id and public.is_not_banned());
create policy "stories del" on public.stories for delete using (auth.uid() = author_id or public.is_admin());
drop policy if exists "logs read" on public.activity_logs;
create policy "logs read" on public.activity_logs for select using (public.is_admin());
create policy "logs insert" on public.activity_logs for insert with check (public.is_admin());
drop policy if exists "pages read" on public.site_pages;
create policy "pages read" on public.site_pages for select using (true);
create policy "pages write" on public.site_pages for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "articles read" on public.articles;
create policy "articles read" on public.articles for select using (published or public.is_admin());
create policy "articles write" on public.articles for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "settings read" on public.site_settings;
create policy "settings read" on public.site_settings for select using (true);
create policy "settings write" on public.site_settings for update using (public.is_admin());
drop policy if exists "usage read" on public.usage_events;
create policy "usage read" on public.usage_events for select using (auth.uid() = user_id or public.is_admin());
create policy "usage insert" on public.usage_events for insert with check (auth.uid() = user_id);

alter table public.posts add column if not exists view_count integer not null default 0;
alter table public.posts add column if not exists share_count integer not null default 0;

create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  primary key (message_id, user_id)
);

alter table public.story_views enable row level security;
alter table public.message_reactions enable row level security;

drop policy if exists "story views read" on public.story_views;
create policy "story views read" on public.story_views for select using (
  viewer_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid())
);
drop policy if exists "story views insert" on public.story_views;
create policy "story views insert" on public.story_views for insert with check (auth.uid() = viewer_id);

drop policy if exists "message reactions read" on public.message_reactions;
create policy "message reactions read" on public.message_reactions for select using (
  public.is_admin() or exists (
    select 1 from public.messages msg
    join public.conversation_members m on m.conversation_id = msg.conversation_id
    where msg.id = message_id and m.user_id = auth.uid()
  )
);
drop policy if exists "message reactions write" on public.message_reactions;
create policy "message reactions write" on public.message_reactions for insert with check (
  auth.uid() = user_id and exists (
    select 1 from public.messages msg
    join public.conversation_members m on m.conversation_id = msg.conversation_id
    where msg.id = message_id and m.user_id = auth.uid()
  )
);
drop policy if exists "message reactions update" on public.message_reactions;
create policy "message reactions update" on public.message_reactions for update using (auth.uid() = user_id);
drop policy if exists "message reactions del" on public.message_reactions;
create policy "message reactions del" on public.message_reactions for delete using (auth.uid() = user_id or public.is_admin());

alter table public.groups add column if not exists avatar_url text;

alter table public.group_members drop constraint if exists group_members_role_check;
alter table public.group_members add constraint group_members_role_check check (role in ('owner','admin','member'));

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.group_message_reactions (
  message_id uuid not null references public.group_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  primary key (message_id, user_id)
);

create index if not exists group_messages_group_idx on public.group_messages (group_id, created_at);

alter table public.group_messages enable row level security;
alter table public.group_message_reactions enable row level security;

drop policy if exists "group messages read" on public.group_messages;
create policy "group messages read" on public.group_messages for select using (
  public.is_admin() or exists (
    select 1 from public.group_members m
    where m.group_id = group_messages.group_id and m.user_id = auth.uid()
  )
);
drop policy if exists "group messages insert" on public.group_messages;
create policy "group messages insert" on public.group_messages for insert with check (
  auth.uid() = sender_id
  and public.is_not_banned()
  and exists (
    select 1 from public.group_members m
    where m.group_id = group_messages.group_id and m.user_id = auth.uid()
  )
);
drop policy if exists "group messages delete" on public.group_messages;
create policy "group messages delete" on public.group_messages for delete using (
  auth.uid() = sender_id or public.is_admin() or public.is_group_manager(group_id)
);

drop policy if exists "group react read" on public.group_message_reactions;
create policy "group react read" on public.group_message_reactions for select using (
  public.is_admin() or exists (
    select 1 from public.group_messages msg
    join public.group_members m on m.group_id = msg.group_id
    where msg.id = message_id and m.user_id = auth.uid()
  )
);
drop policy if exists "group react write" on public.group_message_reactions;
create policy "group react write" on public.group_message_reactions for insert with check (
  auth.uid() = user_id and exists (
    select 1 from public.group_messages msg
    join public.group_members m on m.group_id = msg.group_id
    where msg.id = message_id and m.user_id = auth.uid()
  )
);
drop policy if exists "group react update" on public.group_message_reactions;
create policy "group react update" on public.group_message_reactions for update using (auth.uid() = user_id);
drop policy if exists "group react del" on public.group_message_reactions;
create policy "group react del" on public.group_message_reactions for delete using (auth.uid() = user_id or public.is_admin());

drop policy if exists "group members update" on public.group_members;
create policy "group members update" on public.group_members for update using (
  public.is_admin() or public.is_group_manager(group_id)
);

-- Story kinds: photo, short video, or text. Re-run safe.
alter table public.stories add column if not exists kind text not null default 'photo';
alter table public.stories add column if not exists caption text not null default '';
alter table public.stories drop constraint if exists stories_kind_check;
alter table public.stories add constraint stories_kind_check check (kind in ('photo','video','text'));

-- Chat photos and voice notes live in the message row (no Storage bucket).
-- They disappear after 7 days. Run this once. Safe to re-run.
alter table public.messages add column if not exists image_url text;
alter table public.messages add column if not exists audio_url text;
alter table public.messages add column if not exists audio_seconds smallint;
alter table public.messages add column if not exists expires_at timestamptz;
alter table public.messages alter column body set default '';
update public.messages set expires_at = created_at + interval '7 days' where expires_at is null;
alter table public.messages alter column expires_at set default (now() + interval '7 days');

alter table public.group_messages add column if not exists audio_url text;
alter table public.group_messages add column if not exists audio_seconds smallint;
alter table public.group_messages add column if not exists expires_at timestamptz;
alter table public.group_messages alter column body set default '';
update public.group_messages set expires_at = created_at + interval '7 days' where expires_at is null;
alter table public.group_messages alter column expires_at set default (now() + interval '7 days');

alter table public.messages drop constraint if exists messages_media_size;
alter table public.messages add constraint messages_media_size check (
  (image_url is null or length(image_url) < 160000)
  and (audio_url is null or length(audio_url) < 120000)
);
alter table public.group_messages drop constraint if exists group_messages_media_size;
alter table public.group_messages add constraint group_messages_media_size check (
  (image_url is null or length(image_url) < 160000)
  and (audio_url is null or length(audio_url) < 120000)
);

create index if not exists messages_expires_idx on public.messages (expires_at);
create index if not exists group_messages_expires_idx on public.group_messages (expires_at);

create or replace function public.purge_expired_chats()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.messages
  where coalesce(expires_at, created_at + interval '7 days') < now();
  delete from public.group_messages
  where coalesce(expires_at, created_at + interval '7 days') < now();
end;
$$;

revoke all on function public.purge_expired_chats() from public;
grant execute on function public.purge_expired_chats() to anon, authenticated;

