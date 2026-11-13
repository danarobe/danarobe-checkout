-- 장바구니·주문서 사용 기록 (2026-11-13)
-- 저장 위치: DNRB 워크스페이스와 같은 Supabase 프로젝트(eeffmbusaqaadeojjlnc).
-- 손님 브라우저는 표에 직접 접근하지 못하고, 검사하는 함수 shop_track(text) 하나만 부를 수 있다(쓰기 전용, 읽기 불가).
-- 개인정보(이름·연락처·주소·회원 아이디·IP)는 받지 않는다. 금액·버튼 이름·기기 종류만.

create table if not exists public.shop_events (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  sid text not null,            -- 무작위 방문 묶음 번호(브라우저에서 만듦, 1시간 동안 같은 값)
  page text not null,           -- basket | orderform
  ev text not null,             -- 이벤트 이름
  data jsonb not null default '{}'::jsonb,
  ver text,                     -- 스크립트 버전
  dev text,                     -- ios | and | pc
  ia text,                      -- 인앱 브라우저(ig, fb, kakao, naver, app, 빈 값)
  live boolean                  -- 손님 스킨이면 true, 테스트 스킨(/skin-…)이면 false
);
create index if not exists shop_events_ts on public.shop_events (ts);
create index if not exists shop_events_sid_ts on public.shop_events (sid, ts);
alter table public.shop_events enable row level security;  -- 정책 없음 = 손님(anon)은 읽기·쓰기 불가

create or replace function public.shop_track(text) returns void
language plpgsql security definer set search_path = public as $$
declare b jsonb; e jsonb; n int := 0; s text; pg text; d jsonb;
begin
  if $1 is null or length($1) > 12000 then return; end if;
  begin b := $1::jsonb; exception when others then return; end;
  if jsonb_typeof(b) <> 'object' then return; end if;
  s := b->>'sid'; pg := b->>'p';
  if s is null or s !~ '^[a-z0-9]{8,32}$' or pg is null or pg not in ('basket', 'orderform') then return; end if;
  if jsonb_typeof(b->'ev') is distinct from 'array' then return; end if;
  -- 한 방문 묶음이 1시간에 400건을 넘기면 더 받지 않는다(오작동·장난 방지)
  if (select count(*) from public.shop_events where sid = s and ts > now() - interval '1 hour') > 400 then return; end if;
  -- 전체 상한(묶음 번호를 바꿔 가며 보내는 장난 대비): 1분 2,000건을 넘으면 받지 않는다(평소 1분 수십 건).
  -- 넘치면 그 1분 동안 기록만 빠지고, 손님의 장바구니·결제에는 영향 없음
  if (select count(*) from public.shop_events where ts > now() - interval '1 minute') > 2000 then return; end if;
  for e in select value from jsonb_array_elements(b->'ev') loop
    n := n + 1; exit when n > 40;
    continue when jsonb_typeof(e) <> 'object' or coalesce(e->>'e', '') !~ '^[a-z_]{2,24}$';
    continue when e->>'e' = 'o_alert' and coalesce(e->'d'->>'t', '') !~ '^[a-z]{2,8}(_[a-z]{2,6})?$';
    d := case when jsonb_typeof(e->'d') = 'object' and length((e->'d')::text) <= 1500 then e->'d' else '{}'::jsonb end;
    insert into public.shop_events (sid, page, ev, data, ver, dev, ia, live)
    values (s, pg, e->>'e', d, left(b->>'v', 20), left(b->>'dv', 8), left(b->>'ia', 8), (b->>'lv') = '1');
  end loop;
end $$;
revoke all on function public.shop_track(text) from public;
grant execute on function public.shop_track(text) to anon;

-- 180일 지난 기록은 매일 새벽 3시 17분(KST)에 지운다
-- select cron.schedule('shop-events-cleanup', '17 18 * * *', $$delete from public.shop_events where ts < now() - interval '180 days'$$);
