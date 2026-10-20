# 서버 (Supabase)

프로젝트: `parcel-pals` (ref `wbevtynfofwyhwjzhwpz`, us-west-1, 무료 플랜)

- `migrations/` — 데이터베이스에 적용한 SQL(기록용). 테이블은 모두 RLS로 잠겨 있고, 브라우저는 동기화 코드를 확인하는
  `pp_sync`, `pp_push_subscribe2`, `pp_push_unsubscribe`, `pp_push_public_key` 함수만 부를 수 있어요.
- `functions/poll/` — 30분마다(pg_cron) 동기화된 택배를 조회해서 새 소식이 있으면 Web Push를 보내는 Edge Function.
  `engine.js`는 앱 엔진을 묶은 파일이에요: `node scripts/build-edge.mjs`로 다시 만들고 커밋·push 하세요.
  배포된 함수는 이 파일을 커밋 해시로 고정해서 jsDelivr에서 가져와요
  (`https://cdn.jsdelivr.net/gh/ckvampwolf7/parcel-pals@<커밋>/supabase/functions/poll/engine.js`).
  엔진을 바꿨다면 `index.ts`의 `./engine.js` 대신 새 커밋 주소로 바꿔서 재배포하세요(현재: `c08dae3`).
- 비밀 값(VAPID 키, cron 비밀)은 `app_secrets` 테이블에 있고 서버에서만 읽어요. VAPID 키는 함수가 처음 실행될 때 스스로 만들어요.

무료 플랜은 1주일 넘게 요청이 없으면 프로젝트가 일시정지될 수 있어요(30분마다 도는 cron이 있어서 보통은 괜찮아요).
멈췄다면 https://supabase.com/dashboard/project/wbevtynfofwyhwjzhwpz 에서 "Restore"를 누르면 돼요.
