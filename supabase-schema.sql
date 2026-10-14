-- Cole este arquivo no SQL Editor do projeto Supabase.
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null default 'Usuario',
    bio text not null default '',
    profile_color text not null default '#004c94',
    avatar_url text,
    cover_color text not null default '#004c94',
    cover_url text,
    created_at timestamptz not null default now()
);

create table if not exists public.service_posts (
    id uuid primary key default gen_random_uuid(),
    author_id uuid not null references public.profiles(id) on delete cascade,
    type text not null check (type in ('offer', 'request')),
    title text not null,
    description text not null,
    category text not null default 'Servicos gerais',
    price numeric(10,2),
    image_url text,
    location text,
    contact text,
    created_at timestamptz not null default now(),
    check ((type = 'request' and price is null) or (type = 'offer' and price is not null and price >= 0))
);

alter table public.service_posts add column if not exists location text;
alter table public.service_posts add column if not exists contact text;

create table if not exists public.comments (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.service_posts(id) on delete cascade,
    author_id uuid not null references public.profiles(id) on delete cascade,
    body text not null check (length(trim(body)) > 0),
    created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
    post_id uuid not null references public.service_posts(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (post_id, user_id)
);

create table if not exists public.friend_requests (
    id uuid primary key default gen_random_uuid(),
    sender_id uuid not null references public.profiles(id) on delete cascade,
    receiver_id uuid not null references public.profiles(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
    created_at timestamptz not null default now(),
    check (sender_id <> receiver_id)
);

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    sender_id uuid not null references public.profiles(id) on delete cascade,
    recipient_id uuid not null references public.profiles(id) on delete cascade,
    body text not null check (length(trim(body)) between 1 and 2000),
    created_at timestamptz not null default now(),
    check (sender_id <> recipient_id)
);

create index if not exists service_posts_created_at_idx on public.service_posts(created_at desc);
create index if not exists service_posts_author_id_idx on public.service_posts(author_id);
create index if not exists comments_post_id_idx on public.comments(post_id, created_at);
create index if not exists friend_requests_receiver_status_idx on public.friend_requests(receiver_id, status);
create index if not exists friend_requests_sender_status_idx on public.friend_requests(sender_id, status);
create index if not exists messages_sender_created_at_idx on public.messages(sender_id, created_at);
create index if not exists messages_recipient_created_at_idx on public.messages(recipient_id, created_at);
create unique index if not exists friend_requests_active_unique_idx
on public.friend_requests(sender_id, receiver_id)
where status in ('pending', 'accepted');

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    insert into public.profiles (id, display_name)
    values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Usuario'))
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

-- Garante que contas criadas antes da instalacao do gatilho tambem aparecam
-- nas sugestoes de amizade. Contas futuras sao atendidas pelo gatilho acima.
insert into public.profiles (id, display_name)
select
    users.id,
    coalesce(
        nullif(users.raw_user_meta_data ->> 'display_name', ''),
        nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
        'Usuario'
    )
from auth.users as users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.service_posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.friend_requests enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Profiles are public" on public.profiles;
drop policy if exists "Users create own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Posts are public" on public.service_posts;
drop policy if exists "Users create own posts" on public.service_posts;
drop policy if exists "Users update own posts" on public.service_posts;
drop policy if exists "Users delete own posts" on public.service_posts;
drop policy if exists "Comments are public" on public.comments;
drop policy if exists "Signed-in users comment" on public.comments;
drop policy if exists "Users delete own comments" on public.comments;
drop policy if exists "Likes are public" on public.post_likes;
drop policy if exists "Users like as themselves" on public.post_likes;
drop policy if exists "Users remove own likes" on public.post_likes;
drop policy if exists "Participants read friend requests" on public.friend_requests;
drop policy if exists "Users send friend requests" on public.friend_requests;
drop policy if exists "Receivers answer friend requests" on public.friend_requests;
drop policy if exists "Senders cancel friend requests" on public.friend_requests;
drop policy if exists "Friends read messages" on public.messages;
drop policy if exists "Friends send messages" on public.messages;
drop policy if exists "Profile images are public" on storage.objects;
drop policy if exists "Users upload own images" on storage.objects;
drop policy if exists "Users update own images" on storage.objects;

create policy "Profiles are public" on public.profiles for select using (true);
create policy "Users create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "Posts are public" on public.service_posts for select using (true);
create policy "Users create own posts" on public.service_posts for insert to authenticated with check (auth.uid() = author_id);
create policy "Users update own posts" on public.service_posts for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "Users delete own posts" on public.service_posts for delete to authenticated using (auth.uid() = author_id);

create policy "Comments are public" on public.comments for select using (true);
create policy "Signed-in users comment" on public.comments for insert to authenticated with check (auth.uid() = author_id);
create policy "Users delete own comments" on public.comments for delete to authenticated using (auth.uid() = author_id);

create policy "Likes are public" on public.post_likes for select using (true);
create policy "Users like as themselves" on public.post_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "Users remove own likes" on public.post_likes for delete to authenticated using (auth.uid() = user_id);

create policy "Participants read friend requests" on public.friend_requests for select to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "Users send friend requests" on public.friend_requests for insert to authenticated
with check (auth.uid() = sender_id and sender_id <> receiver_id);
create policy "Receivers answer friend requests" on public.friend_requests for update to authenticated
using (auth.uid() = receiver_id and status = 'pending')
with check (auth.uid() = receiver_id and status in ('accepted', 'declined'));
create policy "Senders cancel friend requests" on public.friend_requests for update to authenticated
using (auth.uid() = sender_id and status = 'pending')
with check (auth.uid() = sender_id and status = 'cancelled');

create policy "Friends read messages" on public.messages for select to authenticated
using (
    (auth.uid() = sender_id or auth.uid() = recipient_id)
    and exists (
        select 1 from public.friend_requests as requests
        where requests.status = 'accepted'
          and (
              (requests.sender_id = messages.sender_id and requests.receiver_id = messages.recipient_id)
              or (requests.sender_id = messages.recipient_id and requests.receiver_id = messages.sender_id)
          )
    )
);

create policy "Friends send messages" on public.messages for insert to authenticated
with check (
    auth.uid() = sender_id
    and exists (
        select 1 from public.friend_requests as requests
        where requests.status = 'accepted'
          and (
              (requests.sender_id = messages.sender_id and requests.receiver_id = messages.recipient_id)
              or (requests.sender_id = messages.recipient_id and requests.receiver_id = messages.sender_id)
          )
    )
);

grant select on public.profiles, public.service_posts, public.comments, public.post_likes to anon, authenticated;
grant insert, update, delete on public.profiles, public.service_posts, public.comments, public.post_likes to authenticated;
grant select, insert, update on public.friend_requests to authenticated;
grant select, insert on public.messages to authenticated;

do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
           select 1 from pg_publication_tables
           where pubname = 'supabase_realtime'
             and schemaname = 'public'
             and tablename = 'messages'
       ) then
        alter publication supabase_realtime add table public.messages;
    end if;
end;
$$;

insert into storage.buckets (id, name, public)
values ('social-images', 'social-images', true)
on conflict (id) do nothing;

create policy "Profile images are public" on storage.objects for select using (bucket_id = 'social-images');
create policy "Users upload own images" on storage.objects for insert to authenticated
with check (bucket_id = 'social-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update own images" on storage.objects for update to authenticated
using (bucket_id = 'social-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'social-images' and (storage.foldername(name))[1] = auth.uid()::text);
