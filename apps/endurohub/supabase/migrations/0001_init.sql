-- EnduroHub MVP — схема БД (подмножество docs/endurohub/04-data-model.md)
-- Покрывает единственный сценарий MVP:
-- «открыл → увидел выезд рядом → присоединился → съездил».

create extension if not exists "uuid-ossp";
create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ─────────────────────────── типы ───────────────────────────
do $$ begin
  create type route_status    as enum ('draft','published','hidden','flagged');
  create type ride_visibility as enum ('open','request','link');
  create type ride_status     as enum ('planned','confirmed','active','finished','cancelled');
  create type participant_status as enum ('requested','approved','declined','left','completed');
exception when duplicate_object then null; end $$;

-- ─────────────────────────── регионы ───────────────────────────
create table if not exists regions (
  id       uuid primary key default uuid_generate_v4(),
  slug     text unique not null,
  name     text not null,
  timezone text not null default 'Europe/Moscow',
  center   geography(Point, 4326) not null
);
create index if not exists idx_regions_center on regions using gist (center);

-- ─────────────────────────── пользователи ───────────────────────────
create table if not exists users (
  id             uuid primary key default uuid_generate_v4(),
  auth_id        uuid unique,                       -- ссылка на auth.users
  telegram_id    bigint unique,
  username       text unique not null,
  display_name   text not null,
  avatar_url     text,
  skill_level    smallint not null default 1 check (skill_level between 1 and 5),
  region_id      uuid references regions(id),
  home_point     geography(Point, 4326),            -- НИКОГДА не отдаётся наружу
  moto_text      text,                              -- в MVP техника хранится текстом
  bio            text,
  rides_count    integer not null default 0,
  is_banned      boolean not null default false,
  created_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);
create index if not exists idx_users_home   on users using gist (home_point);
create index if not exists idx_users_region on users (region_id);

-- ─────────────────────────── маршруты ───────────────────────────
create table if not exists routes (
  id                   uuid primary key default uuid_generate_v4(),
  author_id            uuid not null references users(id),
  title                text not null,
  description          text,
  difficulty           smallint not null check (difficulty between 1 and 5),
  difficulty_confirmed smallint check (difficulty_confirmed between 1 and 5),
  distance_m           integer not null,
  elevation_gain_m     integer not null default 0,
  duration_est_min     integer,
  geom                 geography(LineString, 4326) not null,  -- публичный, обрезанный
  geom_raw             geography(LineString, 4326),           -- полный, только автору
  start_point          geography(Point, 4326) not null,
  end_point            geography(Point, 4326) not null,
  bbox                 geography(Polygon, 4326) not null,
  surface_mix          jsonb not null default '{}'::jsonb,
  is_loop              boolean not null default false,
  region_id            uuid references regions(id),
  rating_avg           numeric(3,2) not null default 0,
  rating_count         integer not null default 0,
  rides_count          integer not null default 0,
  status               route_status not null default 'published',
  source               text,                                   -- gpx_import | manual | recorded
  created_at           timestamptz not null default now()
);
create index if not exists idx_routes_geom   on routes using gist (geom);
create index if not exists idx_routes_bbox   on routes using gist (bbox);
create index if not exists idx_routes_start  on routes using gist (start_point);
create index if not exists idx_routes_filter on routes (region_id, difficulty) where status = 'published';

-- Приватность: публичный трек обрезается на 500 м с каждого конца,
-- производные точки и bbox считаются автоматически.
create or replace function trim_route_privacy() returns trigger as $$
declare len numeric;
begin
  if new.geom_raw is null then
    new.geom_raw := new.geom;
  end if;
  len := st_length(new.geom_raw);
  if len > 2000 then
    new.geom := st_linesubstring(new.geom_raw::geometry, 500 / len, 1 - 500 / len)::geography;
  else
    new.geom := new.geom_raw;
  end if;
  new.start_point := st_startpoint(new.geom::geometry)::geography;
  new.end_point   := st_endpoint(new.geom::geometry)::geography;
  new.bbox        := st_envelope(new.geom::geometry)::geography;
  new.distance_m  := round(st_length(new.geom_raw))::integer;
  return new;
end $$ language plpgsql;

drop trigger if exists trg_route_privacy on routes;
create trigger trg_route_privacy
  before insert or update of geom, geom_raw on routes
  for each row execute function trim_route_privacy();

create table if not exists route_ratings (
  id         uuid primary key default uuid_generate_v4(),
  route_id   uuid not null references routes(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  difficulty smallint check (difficulty between 1 and 5),
  comment    text,
  conditions text,
  created_at timestamptz not null default now(),
  unique (route_id, user_id)
);

-- ─────────────────────────── выезды ───────────────────────────
create table if not exists rides (
  id                 uuid primary key default uuid_generate_v4(),
  organizer_id       uuid not null references users(id),
  route_id           uuid references routes(id) on delete set null,
  title              text not null,
  description        text,
  difficulty         smallint not null check (difficulty between 1 and 5),
  starts_at          timestamptz not null,
  meeting_point      geography(Point, 4326) not null,
  meeting_address    text,
  capacity           smallint not null default 10 check (capacity between 2 and 60),
  participants_count smallint not null default 1,
  visibility         ride_visibility not null default 'open',
  requirements       jsonb not null default '[]'::jsonb,
  checklist          jsonb not null default '[]'::jsonb,
  status             ride_status not null default 'planned',
  telegram_chat_id   bigint,                                  -- группа выезда, созданная ботом
  created_at         timestamptz not null default now()
);
create index if not exists idx_rides_geo  on rides using gist (meeting_point)
  where status in ('planned','confirmed');
create index if not exists idx_rides_time on rides (starts_at)
  where status in ('planned','confirmed');

create table if not exists ride_participants (
  ride_id   uuid not null references rides(id) on delete cascade,
  user_id   uuid not null references users(id) on delete cascade,
  status    participant_status not null default 'requested',
  role      text not null default 'rider',
  note      text,
  joined_at timestamptz not null default now(),
  primary key (ride_id, user_id)
);
create index if not exists idx_participants_user on ride_participants (user_id, joined_at desc);

-- Счётчик участников держим в rides, чтобы лента не делала count() на каждой карточке.
create or replace function sync_participants_count() returns trigger as $$
declare rid uuid;
begin
  rid := coalesce(new.ride_id, old.ride_id);
  update rides r
     set participants_count = (
       select count(*) from ride_participants p
        where p.ride_id = rid and p.status in ('approved','completed')
     )
   where r.id = rid;
  return null;
end $$ language plpgsql;

drop trigger if exists trg_participants_count on ride_participants;
create trigger trg_participants_count
  after insert or update of status or delete on ride_participants
  for each row execute function sync_participants_count();

-- ─────────────────────────── RPC для клиента ───────────────────────────

-- Выезды рядом: главный запрос приложения.
create or replace function rides_nearby(
  p_lat        double precision,
  p_lng        double precision,
  p_radius_m   integer default 150000,
  p_from       timestamptz default now(),
  p_to         timestamptz default now() + interval '30 days',
  p_diff_min   smallint default 1,
  p_diff_max   smallint default 5,
  p_only_slots boolean default false
) returns table (
  id                 uuid,
  title              text,
  difficulty         smallint,
  starts_at          timestamptz,
  meeting_address    text,
  meeting_lat        double precision,
  meeting_lng        double precision,
  distance_km        integer,
  capacity           smallint,
  participants_count smallint,
  route_id           uuid,
  route_distance_m   integer,
  organizer_name     text,
  organizer_level    smallint
) language sql stable as $$
  select r.id, r.title, r.difficulty, r.starts_at, r.meeting_address,
         st_y(r.meeting_point::geometry), st_x(r.meeting_point::geometry),
         round(st_distance(r.meeting_point,
               st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000)::integer,
         r.capacity, r.participants_count,
         r.route_id, rt.distance_m,
         u.display_name, u.skill_level
    from rides r
    join users u on u.id = r.organizer_id
    left join routes rt on rt.id = r.route_id
   where r.status in ('planned','confirmed')
     and r.starts_at between p_from and p_to
     and r.difficulty between p_diff_min and p_diff_max
     and st_dwithin(r.meeting_point,
                    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
                    p_radius_m)
     and (not p_only_slots or r.participants_count < r.capacity)
   order by r.starts_at, 8
   limit 100;
$$;

-- Маршруты в видимой области карты. Геометрия упрощается по уровню зума:
-- без этого ответ на z=8 весит мегабайты.
create or replace function routes_in_bbox(
  p_west     double precision,
  p_south    double precision,
  p_east     double precision,
  p_north    double precision,
  p_zoom     integer default 12,
  p_diff_min smallint default 1,
  p_diff_max smallint default 5
) returns table (
  id          uuid,
  title       text,
  difficulty  smallint,
  distance_m  integer,
  rating_avg  numeric,
  rides_count integer,
  geojson     json
) language sql stable as $$
  select r.id, r.title, r.difficulty, r.distance_m, r.rating_avg, r.rides_count,
         st_asgeojson(
           st_simplify(r.geom::geometry,
             case when p_zoom < 10 then 0.001
                  when p_zoom < 13 then 0.0002
                  else 0 end)
         )::json
    from routes r
   where r.status = 'published'
     and r.difficulty between p_diff_min and p_diff_max
     and r.geom && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)::geography
   order by r.rating_avg desc nulls last, r.rides_count desc
   limit 300;
$$;

-- Вступление в выезд. Атомарно: проверка мест и вставка под блокировкой строки,
-- иначе на популярном выезде двое займут последнее место одновременно.
create or replace function join_ride(p_ride_id uuid, p_note text default null)
returns participant_status language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_ride    rides%rowtype;
  v_status  participant_status;
begin
  select id into v_user_id from users where auth_id = auth.uid();
  if v_user_id is null then
    raise exception 'user not found for current session';
  end if;

  select * into v_ride from rides where id = p_ride_id for update;
  if not found then
    raise exception 'ride not found';
  end if;
  if v_ride.status not in ('planned','confirmed') then
    raise exception 'ride is not open for joining';
  end if;
  if v_ride.participants_count >= v_ride.capacity then
    raise exception 'ride is full';
  end if;

  v_status := case when v_ride.visibility = 'request'
                   then 'requested'::participant_status
                   else 'approved'::participant_status end;

  insert into ride_participants (ride_id, user_id, status, note)
  values (p_ride_id, v_user_id, v_status, p_note)
  on conflict (ride_id, user_id)
    do update set status = excluded.status, note = excluded.note;

  return v_status;
end $$;

-- ─────────────────────────── RLS ───────────────────────────
-- Anon-ключ лежит в клиенте, поэтому без RLS база открыта наружу.
-- Это первая задача спринта, а не последняя.

alter table users             enable row level security;
alter table routes            enable row level security;
alter table route_ratings     enable row level security;
alter table rides             enable row level security;
alter table ride_participants enable row level security;
alter table regions           enable row level security;

drop policy if exists regions_read on regions;
create policy regions_read on regions for select using (true);

-- Профили публичны на чтение; home_point наружу не отдаётся — для клиента
-- существует вьюха users_public, а прямой select по таблице закрыт грантами.
drop policy if exists users_read on users;
create policy users_read on users for select using (not is_banned);

drop policy if exists users_write on users;
create policy users_write on users for update
  using (auth_id = auth.uid()) with check (auth_id = auth.uid());

drop policy if exists routes_read on routes;
create policy routes_read on routes for select
  using (status = 'published' or author_id in (select id from users where auth_id = auth.uid()));

drop policy if exists routes_insert on routes;
create policy routes_insert on routes for insert
  with check (author_id in (select id from users where auth_id = auth.uid()));

drop policy if exists routes_update on routes;
create policy routes_update on routes for update
  using (author_id in (select id from users where auth_id = auth.uid()));

drop policy if exists ratings_read on route_ratings;
create policy ratings_read on route_ratings for select using (true);

drop policy if exists ratings_write on route_ratings;
create policy ratings_write on route_ratings for all
  using (user_id in (select id from users where auth_id = auth.uid()))
  with check (user_id in (select id from users where auth_id = auth.uid()));

drop policy if exists rides_read on rides;
create policy rides_read on rides for select using (visibility in ('open','request'));

drop policy if exists rides_insert on rides;
create policy rides_insert on rides for insert
  with check (organizer_id in (select id from users where auth_id = auth.uid()));

drop policy if exists rides_update on rides;
create policy rides_update on rides for update
  using (organizer_id in (select id from users where auth_id = auth.uid()));

drop policy if exists participants_read on ride_participants;
create policy participants_read on ride_participants for select using (true);

drop policy if exists participants_self on ride_participants;
create policy participants_self on ride_participants for delete
  using (user_id in (select id from users where auth_id = auth.uid()));

-- Публичная проекция профиля без геоданных.
create or replace view users_public as
  select id, username, display_name, avatar_url, skill_level,
         region_id, moto_text, bio, rides_count, created_at
    from users
   where not is_banned;
