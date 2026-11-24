-- MV MODS — rode tudo isto no Supabase: SQL Editor > New query > Run

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null, avatar_url text,
  role text not null default 'user' check (role in ('miguel','miguel')),
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);
create table contents (
  id uuid primary key default gen_random_uuid(),
  name text not null, category text not null check (category in ('Jogo','Skin','Xite')),
  description text, cover_url text, banner_url text,
  version text default '1.0', status text default 'Atualizado',
  published boolean not null default true,
  featured boolean not null default false, featured_title text, featured_desc text,
  created_at timestamptz not null default now()
);
create table versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references contents on delete cascade,
  version text not null, notes text, is_current boolean default false,
  created_at timestamptz not null default now()
);
create table downloads (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references versions on delete cascade, url text not null
);
create table favorites (
  user_id uuid references profiles on delete cascade,
  content_id uuid references contents on delete cascade, primary key (user_id, content_id)
);
create table site_settings (
  id int primary key default 1 check (id = 1),
  theme text default 'dark', primary_color text default '#8b5cf6',
  button_style text default 'arredondado', card_size text default 'compacto'
);
insert into site_settings (id) values (1);

-- Cria o perfil automaticamente no cadastro (sempre como 'user')
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username) values (new.id, coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create function is_admin() returns boolean language sql security definer stable set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and not blocked) $$;
create function is_active_user() returns boolean language sql security definer stable set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and not blocked) $$;

alter table profiles enable row level security;
alter table contents enable row level security;
alter table versions enable row level security;
alter table downloads enable row level security;
alter table favorites enable row level security;
alter table site_settings enable row level security;

-- profiles: cada um vê o seu; ADM vê e altera todos (usuário comum NÃO altera nada -> não vira ADM)
create policy "ver proprio" on profiles for select using (id = auth.uid() or is_admin());
create policy "adm altera" on profiles for update using (is_admin());
-- contents / versions: todos veem publicados; só ADM escreve
create policy "ler publicados" on contents for select using (published or is_admin());
create policy "adm escreve contents" on contents for all using (is_admin()) with check (is_admin());
create policy "ler versoes" on versions for select using (true);
create policy "adm escreve versions" on versions for all using (is_admin()) with check (is_admin());
-- downloads: só usuários logados e não bloqueados
create policy "ler downloads" on downloads for select using (is_active_user());
create policy "adm escreve downloads" on downloads for all using (is_admin()) with check (is_admin());
create policy "favoritos" on favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ler config" on site_settings for select using (true);
create policy "adm altera config" on site_settings for update using (is_admin());

-- Armazenamento de imagens
insert into storage.buckets (id, name, public) values ('media','media', true);
create policy "imagens publicas" on storage.objects for select using (bucket_id = 'media');
create policy "adm envia imagens" on storage.objects for insert with check (bucket_id = 'media' and is_admin());
create policy "adm altera imagens" on storage.objects for update using (bucket_id = 'media' and is_admin());
create policy "adm apaga imagens" on storage.objects for delete using (bucket_id = 'media' and is_admin());

-- DEPOIS de criar sua conta no site, torne-se ADM (troque o e-mail e rode):
-- update profiles set role = 'admin' where id = (select id from auth.users where email = 'miguel@miguel');
