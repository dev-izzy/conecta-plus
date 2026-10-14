-- Execute no SQL Editor do Supabase para habilitar localizacao e contato nos posts.
alter table public.service_posts
    add column if not exists location text,
    add column if not exists contact text;
