-- Wedding playlist: songs + anonymous votes.
-- Run once in Supabase → SQL Editor. Safe to re-run (drops and recreates the functions).
--
-- Security model: the anon key is public, so guests never touch the tables directly.
-- RLS is on with no policies (= no direct access); everything goes through the
-- security-definer functions below, which enforce the limits.
-- Who suggested/voted is stored only as a random per-device id and is never returned.

create extension if not exists pgcrypto;

create table if not exists songs (
  id           uuid primary key default gen_random_uuid(),
  norm_key     text not null unique,              -- normalised "title|artist", the dedupe key
  title        text not null check (char_length(title) between 1 and 120),
  artist       text not null default '' check (char_length(artist) <= 120),
  artwork_url  text,
  preview_url  text,
  external_url text,
  source       text not null default 'manual' check (source in ('itunes', 'manual')),
  hidden       boolean not null default false,    -- set true in the dashboard to remove a song
  created_by   uuid not null,
  created_at   timestamptz not null default now()
);

create table if not exists votes (
  song_id    uuid not null references songs(id) on delete cascade,
  voter_id   uuid not null,
  created_at timestamptz not null default now(),
  primary key (song_id, voter_id)
);

create index if not exists votes_voter_idx on votes (voter_id);

alter table songs enable row level security;
alter table votes enable row level security;
revoke all on songs, votes from anon, authenticated;

-- Limits. Keep in sync with js/playlist-config.js
create or replace function vote_limit() returns int language sql immutable as $$ select 5 $$;
create or replace function song_limit() returns int language sql immutable as $$ select 3 $$;

-- Public ranking (anonymous: no voter or creator ids)
create or replace function get_ranking()
returns table (
  id uuid, title text, artist text, artwork_url text, preview_url text,
  external_url text, source text, votes int, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select s.id, s.title, s.artist, s.artwork_url, s.preview_url, s.external_url, s.source,
         count(v.song_id)::int as votes, s.created_at
  from songs s
  left join votes v on v.song_id = s.id
  where not s.hidden
  group by s.id
  order by votes desc, s.created_at asc;
$$;

-- Songs this device has voted for
create or replace function my_votes(p_voter uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select v.song_id from votes v join songs s on s.id = v.song_id
  where v.voter_id = p_voter and not s.hidden;
$$;

-- Vote / un-vote. Returns true if the vote is now on.
create or replace function toggle_vote(p_song uuid, p_voter uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from votes where song_id = p_song and voter_id = p_voter;
  if found then
    return false;
  end if;
  if not exists (select 1 from songs where id = p_song and not hidden) then
    raise exception 'not_found';
  end if;
  if (select count(*) from votes where voter_id = p_voter) >= vote_limit() then
    raise exception 'vote_limit';
  end if;
  insert into votes (song_id, voter_id) values (p_song, p_voter);
  return true;
end;
$$;

-- Add a song (or find it if the normalised key already exists) and vote for it.
-- Returns {"id": ..., "created": true|false}
create or replace function add_song(
  p_norm_key text, p_title text, p_artist text,
  p_artwork_url text, p_preview_url text, p_external_url text,
  p_source text, p_voter uuid
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_created boolean := false;
begin
  if coalesce(trim(p_norm_key), '') in ('', '|') or coalesce(trim(p_title), '') = '' then
    raise exception 'invalid';
  end if;

  select id into v_id from songs where norm_key = p_norm_key;

  if v_id is null then
    if (select count(*) from songs where created_by = p_voter) >= song_limit() then
      raise exception 'song_limit';
    end if;
    if (select count(*) from votes where voter_id = p_voter) >= vote_limit() then
      raise exception 'vote_limit';
    end if;
    insert into songs (norm_key, title, artist, artwork_url, preview_url, external_url, source, created_by)
    values (
      left(p_norm_key, 260), trim(p_title), coalesce(trim(p_artist), ''),
      -- only accept Apple catalogue URLs; anything else is dropped
      case when p_artwork_url ~ '^https://[a-z0-9.-]+\.mzstatic\.com/' then p_artwork_url end,
      case when p_preview_url ~ '^https://[a-z0-9.-]+\.(mzstatic|apple)\.com/' then p_preview_url end,
      case when p_external_url ~ '^https://(music|itunes)\.apple\.com/' then p_external_url end,
      case when p_source = 'itunes' then 'itunes' else 'manual' end,
      p_voter
    )
    on conflict (norm_key) do nothing
    returning id into v_id;

    if v_id is null then
      select id into v_id from songs where norm_key = p_norm_key;  -- lost a race: someone added it first
    else
      v_created := true;
    end if;
  end if;

  if not exists (select 1 from songs where id = v_id and not hidden) then
    raise exception 'not_found';
  end if;

  if not exists (select 1 from votes where song_id = v_id and voter_id = p_voter) then
    if (select count(*) from votes where voter_id = p_voter) >= vote_limit() then
      raise exception 'vote_limit';
    end if;
    insert into votes (song_id, voter_id) values (v_id, p_voter);
  end if;

  return jsonb_build_object('id', v_id, 'created', v_created);
end;
$$;

revoke all on function get_ranking(), my_votes(uuid), toggle_vote(uuid, uuid),
  add_song(text, text, text, text, text, text, text, uuid) from public;
grant execute on function get_ranking(), my_votes(uuid), toggle_vote(uuid, uuid),
  add_song(text, text, text, text, text, text, text, uuid) to anon, authenticated;
