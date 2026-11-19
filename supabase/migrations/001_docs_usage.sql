-- U12 备课助手: per-coach documents (same layout as the Artifact database) and daily usage for the cost cap.
-- Run once in the Supabase SQL editor (project region: Frankfurt).

create table public.docs (
  owner uuid not null references auth.users(id) on delete cascade,
  coll text not null,              -- path below data/users/<id>: '' = threads, held, library; 't_xxx/msgs' = a thread's messages
  id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner, coll, id)
);
create index docs_owner_coll on public.docs (owner, coll);
alter table public.docs enable row level security;
create policy docs_own on public.docs for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- written only by the server (service role); RLS on with no policy = invisible to signed-in users
create table public.usage (
  owner uuid not null references auth.users(id) on delete cascade,
  day date not null,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  calls int not null default 0,
  primary key (owner, day)
);
alter table public.usage enable row level security;

create function public.add_usage(p_owner uuid, p_in bigint, p_out bigint) returns void
language sql security definer set search_path = public as $$
  insert into usage (owner, day, input_tokens, output_tokens, calls)
  values (p_owner, (now() at time zone 'utc')::date, p_in, p_out, 1)
  on conflict (owner, day) do update set
    input_tokens = usage.input_tokens + excluded.input_tokens,
    output_tokens = usage.output_tokens + excluded.output_tokens,
    calls = usage.calls + 1;
$$;
revoke execute on function public.add_usage(uuid, bigint, bigint) from public, anon, authenticated;
