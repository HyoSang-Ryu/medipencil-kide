## GitHub에서 실행

- 화면: https://hyosang-ryu.github.io/medipencil-kide/
- 소스: https://github.com/HyoSang-Ryu/medipencil-kide
- 서버·D1·비공개 R2: 기존 https://medipencil-care-demo-hs1105.ryu22620.chatgpt.site 유지

GitHub Pages는 정적 화면을 제공하며 기존 API가 로그인·회원 승인·가족 연결·데이터 저장·사진 권한을 처리합니다. `main`에 push하면 `.github/workflows/pages.yml`이 `node scripts/build-pages.mjs`로 화면을 만들고 Pages에 자동 배포합니다. API 소스 변경은 기존 Sites 빌드·배포 과정으로 별도 배포해야 합니다. Pages에 서버가 실행되거나 DB가 복제되는 구조는 아닙니다.

Pages에서는 제3자 쿠키 대신 24시간 만료 세션을 `sessionStorage`에 보관하고 `X-MP-Session`으로 전달합니다. 로그아웃은 서버 세션을 폐기합니다. API는 정확히 `https://hyosang-ryu.github.io` 출처만 추가 허용하며 외부 요청의 쿠키는 무시합니다. 같은 GitHub 계정의 Pages 저장소는 동일 출처를 공유하므로 이 배포는 합성 데이터 데모용입니다. 기존 서버 주소에서는 HttpOnly 쿠키 로그인을 유지합니다. 사진은 공개 정적 폴더로 복사하지 않고 인증된 API 응답으로 표시합니다. 사용자 비밀번호·세션·DB 파일은 배포 산출물에 포함하지 않습니다.

로컬 Pages 산출물 생성: `node scripts/build-pages.mjs` (`pages-dist/`, Git 제외). 서버 연결 검증: 표준 입력에 `{"password":"테스트 비밀번호"}`를 전달해 `node tests/pages-auth.mjs` 실행. 기존 동일 출처 쿠키 경로는 `tests/test-accounts.mjs`로 별도 검증합니다.

# MediPencil Care Bridge

기존 의료진·보호자 디자인과 합성 환자 데이터·AI 생성 사진을 유지한 이메일/비밀번호 기반 케어 프로그램입니다.

## 회원가입·승인

- `/login.html`: 이메일·비밀번호 로그인 및 회원가입. 가입 구분은 의료진 또는 보호자입니다. 관리자 역할로 자가 가입할 수 없습니다.
- 신규 가입자는 항상 `pending`입니다. 기존 이메일 등록 정보가 있어도 자가 가입만으로 이전 승인을 물려받지 않으며 가족 연결도 초기화합니다.
- 관리자는 `/accounts.html`에서 가입자의 본인 여부를 확인한 뒤 의료진 역할을 승인하거나 보호자에게 가족을 연결합니다.
- 보호자는 가족 연결 전까지 사용할 수 없습니다. 승인된 보호자도 서버가 허용한 가족의 기록·대화·예약·사진만 조회할 수 있으며 직접 역할이나 가족을 변경할 수 없습니다.
- 가입 이메일의 소유 확인 메일과 비밀번호 재설정 메일은 아직 연결하지 않았습니다. 관리자 승인 전에 신청자의 본인 여부 및 가족 관계를 별도로 확인해야 합니다.
- 환자 데이터 API는 자체 로그인 세션을 요구합니다. 기존 ChatGPT 인증 헤더나 과거 역할 쿠키는 일반 앱 로그인으로 인정하지 않습니다.

## 관리자 최초 전환

기존 관리자는 기존 관리자로 접속했던 브라우저에서 `/setup-admin.html`을 열어 최초 비밀번호를 직접 설정합니다. `ADMIN_EMAIL` 비밀 설정과 기존 플랫폼에서 검증된 관리자만 이 전환 절차를 시작할 수 있습니다. 전환 자격은 최대 24시간의 HttpOnly 쿠키와 서버 DB 해시로 유지합니다. 이 쿠키는 비밀번호 최초 설정에만 쓸 수 있고 환자 조회 권한은 주지 않습니다.

설정이 끝나면 전환 자격은 폐기됩니다. 이후 기존 플랫폼 인증으로 비밀번호를 덮어쓰거나 일반 앱 데이터에 접속할 수 없으며, 이메일과 설정한 비밀번호로 로그인해야 합니다. 첫 가입자를 관리자로 승격하는 기능은 없습니다.

## 비밀번호·세션

- 비밀번호는 12~128자, 무작위 128비트 salt를 사용하는 scrypt(`N=32768, r=8, p=3`) 해시로만 저장합니다. 비밀번호 원문은 응답·업무 이력·로그에 기록하지 않습니다. 비교에는 constant-time 연산을 사용합니다.
- scrypt 설정은 [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt)의 메모리 32MiB 설정을 따릅니다. Worker는 [Cloudflare node:crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/)를 사용합니다.
- 세션은 무작위 256비트 토큰이며 DB에는 SHA-256 해시만 저장합니다. HTTPS에서는 `__Host-mp_session`, HttpOnly, Secure, SameSite=Lax, Path=/를 사용하고 24시간 후 만료됩니다. 로컬 HTTP에서는 `mp_session` 쿠키를 사용합니다.
- 로그아웃은 서버 세션을 폐기합니다. `/password.html`에서 현재 비밀번호 확인 후 변경하면 다른 기기의 세션도 모두 폐기합니다.
- 회원가입과 로그인에 DB 기반 IP·이메일 단위 횟수 제한을 적용합니다. 존재하지 않는 이메일도 동일한 비용의 비밀번호 연산을 수행합니다. 변경 요청의 출처·JSON 형식과 요청 크기도 검사합니다.
- 관리자가 접근을 중지하거나 가족 연결을 바꾸면 다음 요청부터 반영됩니다.

## 배포 접속

ChatGPT 로그인 없이 회원가입·로그인 화면을 열도록 Sites의 접속 게이트를 공개로 전환합니다. 이는 환자 데이터 공개를 의미하지 않습니다. 모든 데이터와 사진 API는 별도 로그인·승인·가족 권한을 확인합니다. 정적 화면에는 환자 데이터가 들어 있지 않습니다.

## 저장·업무 기능

브라우저 → `/api/*` → Cloudflare Worker(Vinext) → D1(SQLite). 사진은 비공개 R2(`BUCKET`)에 저장하며 `/api/photos/:patientId`가 인증·권한 확인 후 전달합니다. 사진의 공개 정적 URL은 없습니다. 데이터는 브라우저 로컬스토리지에 저장하지 않으며 활성 화면은 5초마다 갱신합니다.

- 의료진: 환자 검색·필터, 케어 임시저장·공유, 안부 발송, 문의 답변, 면회 승인·반려·취소, DB 기반 리포트, 업무 이력.
- 보호자: 가족의 공유 기록·안부 조회, 문의·응원·답장, 열람 확인, 면회 신청·취소 및 승인 상태 확인.
- 관리자: 가입 승인·역할 지정·가족 연결·접근 중지 및 PNG 합성 프로필 사진 등록.

EHR, 알림톡, 외부 센서, 결제, AI 의료 분석은 연결하지 않습니다. 모든 환자 데이터와 인물 사진은 합성입니다.

## 생성 사진

원본 `assets/generated/p1.png`~`p4.png`, 프롬프트 `assets/generated/prompts.json`. 이미지 생성기로 가상의 인물 4명을 생성하고 비공개 배포 R2에 등록했습니다. 재배포 시 기존 사진이나 업무 기록을 덮어쓰지 않습니다.

## 로컬 개발·검증

Node.js 22.13 이상, `npm ci`. 로컬 `.dev.vars`의 `ADMIN_EMAIL="seedy@sites.test"`는 최초 관리자 전환 테스트에만 사용합니다. 실제 관리자 이메일은 배포 비밀 설정으로 관리합니다.

1. `npm run build`.
2. 초기 로컬 DB에 `drizzle/0000_short_ares.sql`, `0001_wide_skin.sql`, `0002_flippant_amphibian.sql`, `0003_romantic_raza.sql`을 순서대로 한 번씩 적용합니다.
   `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file <migration.sql>`
3. `npm run dev` → `http://localhost:5173/login.html`.
4. `node tests/integration.mjs`는 루프백 서버에서만 실행합니다. 실제 비밀번호 가입·로그인, 승인 대기, 가족 범위, 권한 회수, 사진 접근, 전송·예약, 비밀번호 교체·세션 폐기·횟수 제한을 검증합니다. 테스트 계정은 로컬 DB에만 생성합니다.
5. `npx tsc --noEmit`, `node --check public/app.js` 등으로 검사합니다.

`/__test/signin`은 루프백 개발 서버에서 기존 관리자 전환 자격을 준비하는 용도이며 생산 Worker에는 포함하지 않습니다. 일반 앱 로그인으로 사용할 수 없습니다. 배포는 기존 `.openai/hosting.json`의 D1·R2를 유지하며 적용된 마이그레이션은 수정하지 않습니다.

## 요청된 테스트 계정 (2026-11-08)

`doctor@demo.test`는 승인된 의료진, `family@demo.test`는 김순자(p1)에게만 연결된 보호자 계정입니다. 관리자 권한은 없습니다. `lib/test-accounts.ts`의 해시 기반 일회 설치 데이터가 기존 비밀번호·권한·가족 연결을 덮어쓰지 않고 생성합니다. `seed_installations`에 적용 여부를 기록하므로 재배포나 재접속이 비밀번호를 재설정하거나 중지된 계정을 다시 활성화하지 않습니다. 두 계정은 합성 데이터 테스트용입니다.

`tests/test-accounts.mjs`는 표준 입력 JSON의 `origin`, `password`로 로그인·가족 범위·관리자 권한 차단·로그아웃을 검증합니다. 비밀번호는 테스트 파일에 보관하지 않습니다.

### 관리자 테스트 계정 추가

명시적 요청으로 `admin@demo.test` 관리자 테스트 계정을 추가했습니다. 별도 일회 설치 키(`approved-admin-test-account-v1`)를 사용하며 기존 사이트 소유자·의료진·보호자 계정의 비밀번호나 가족 연결을 변경하지 않습니다. 관리자 테스트 계정은 회원 승인·권한 지정·가족 연결 등 앱 관리자 기능을 사용할 수 있습니다. 재접속이나 재배포가 이 계정의 변경된 비밀번호를 되돌리지 않습니다.

## 활동 사진

누락된 사진 영역을 보호자 홈(9), 케어 일지(4), 의료진 소통 화면(3)에 복원했습니다. `image_gen` 내장 도구로 기존 합성 프로필과 일관된 활동 장면 6장을 생성했습니다. 원본·프롬프트는 `assets/generated/activities/`에 있고 앱에서는 공개 정적 이미지로 복사하지 않습니다. `lib/activity-photos.ts`의 합성 장면 메타데이터는 `/api/state`에서 현재 허용된 환자만 반환하며, 이미지는 비공개 R2의 `patients/{patientId}/{asset}.png`를 권한 확인 후 제공합니다. 합성 장면은 실제 케어 수행 근거가 아닙니다.

등록은 관리자 비밀번호를 표준 입력 JSON으로 전달해 `node scripts/upload-activity-photos.mjs` 실행합니다. 등록 과정은 환자 정보·가족 연결·기존 프로필 사진을 변경하지 않습니다. 사진을 누르면 크게 볼 수 있고 닫기 버튼 또는 Esc로 닫습니다. `tests/pages-auth.mjs`에서 활동 목록 범위와 다른 가족 사진 차단도 검증합니다.

## ZIP 모바일 디자인 및 검증

`public/mobile.css`와 보호자 화면은 제공 ZIP의 모바일 5종 시안(_9 홈, _4 일지, _7 메시지, _8 면회, _5 가족 관리)을 기준으로 구성했습니다. 원본의 환자 요약·사진 소식·날짜 선택·탭·면회 방식 카드·하단 메뉴를 실제 API 데이터에 연결합니다. 정렬·입력·사진 확대를 브라우저의 320/390/430px 화면에서 검증했습니다. 상세 결과와 원본 대비 차이는 `design-qa.md`에 기록했습니다. 실제 스마트폰의 키보드 동작은 별도 검증 대상입니다.

## ZIP 의료진 디자인 및 검증

의료진 4종(_6 병동 현황, _2 케어 일지, _3 보호자 소통, _1 리포트)은 원본 ZIP과 나란히 비교해 누락된 구성과 정렬을 복원했습니다. `public/staff.css`가 반응형 배치를, `public/staff-charts.js`가 DB 기록에 기반한 차트와 수치 표를 담당합니다. 리포트는 7/14/30일 및 환자/병동 범위를 선택할 수 있습니다. 투약·처치 확인, 맥박·수분·연하 관찰은 기존 간호 소견에 라벨과 함께 저장됩니다. 상세 검증 및 데이터에 따른 원본 차이는 `staff-design-qa.md`에 있습니다.

`tests/staff-ui-records.mjs`는 브라우저로 로컬에 작성한 QA 임시/공유 기록을 새 의료진·보호자 세션으로 읽어 저장값과 공개 범위를 검증합니다. 테스트 계정 비밀번호는 표준 입력 JSON으로만 전달하며 공개 사이트에 테스트 기록을 만들지 않습니다.
