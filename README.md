# 다나로브 주문서 꾸미기 (결제슉 대체)

카페24 주문서(결제페이지)를 결제슉 없이 우리 코드로 꾸미는 프로젝트입니다.
관리 화면에서 설정을 바꾸고 **저장 후 적용**을 누르면 주문서에 반영됩니다.

## 구성

| 폴더 | 내용 |
|---|---|
| `admin/` | 관리 화면 (브라우저에서 여는 설정 페이지, 미리보기 포함) |
| `server/` | 관리 화면 서버 (`localhost:3006`) · 설정 저장 · GitHub 배포 |
| `skin/` | 카페24 스킨에 들어가는 파일: `orderform.html`(껍데기), `checkout.css`, `checkout.js` |
| `docs/` | GitHub Pages 로 공개되는 폴더. `config.js`(설정) + css/js 가 여기서 주문서로 읽힘 |
| `data/config.json` | 현재 설정. `data/history/` 에 최근 30개 저장본(되돌리기용) |
| `ANALYSIS.md` | 결제슉 조사 결과 |

## 동작 원리

1. 카페24 스킨의 `order/orderform.html` 에 아래 3줄이 들어 있습니다 (처음 한 번만 설치).
   ```html
   <link rel="stylesheet" href="https://danarobe.github.io/danarobe-checkout/checkout.css">
   <script src="https://danarobe.github.io/danarobe-checkout/config.js"></script>
   <script src="https://danarobe.github.io/danarobe-checkout/checkout.js"></script>
   ```
2. 주문서가 열리면 `config.js`(설정)를 읽어 `checkout.js` 가 로고·색·결제수단 모양·뱃지·안내문구·프로모션을 그립니다.
3. 관리 화면에서 **저장 후 적용** → `docs/config.js` 가 새로 만들어지고 GitHub 에 올라감 → 1~3분 뒤 주문서에 반영.

카페24 결제 로직(원터치 주문서 조각 `order/ec_orderform/*.html`)은 전혀 건드리지 않습니다.
카페24 Admin API 의 "디자인 파일 쓰기"는 승인된 업체만 쓸 수 있어서, 설정은 GitHub Pages 로 전달하는 방식을 택했습니다.

## 켜기

- 더블클릭: `시작.command` → 브라우저에 `http://localhost:3006` 이 열립니다.
- 또는 터미널: `cd ~/danarobe-checkout && npm start`
- 항상 켜 두기: `~/Library/LaunchAgents/com.danarobe.danarobe-checkout.plist` (설치돼 있으면 로그인 시 자동 실행)

## 처음 한 번 (설치 순서)

1. **GitHub 저장소** `danarobe/danarobe-checkout` 가 연결되어 있고 GitHub Pages(main 브랜치 `/docs`)가 켜져 있어야 합니다. → 관리 화면 "적용 상태 · 설치"에서 연결 여부 확인.
2. **테스트 스킨에 먼저 설치**: 카페24 관리자 → 디자인 → 대표 스킨 "복사"로 테스트 스킨 생성 → 스킨 편집 → `order/orderform.html` 을 관리 화면 "설치" 카드의 내용으로 교체 → 미리보기 주소에서 주문서 확인.
3. **소액 실결제 테스트** (신용카드 1건, 무통장 1건, 네이버페이 1건) 후 환불.
4. 이상 없으면 **대표 스킨**의 `order/orderform.html` 도 같은 내용으로 교체.
5. 결제슉 해지. 해지 후 결제슉이 주문서를 "원복"하므로, 원복 뒤 `order/orderform.html` 이 우리 것인지 다시 확인.

## 아직 안 된 것

- **쿠폰 팝업창 기능**(사용불가 쿠폰 표시 / 최대혜택 자동적용 / 안내문구): 카페24 쿠폰 팝업의 실제 구조를 회원 계정으로 확인한 뒤 연결. 설정은 저장되지만 아직 화면에 영향 없음. (최대혜택 자동적용은 예상 구조가 맞을 때만 동작하는 안전 모드)
- 다나로브 실제 스킨의 `order/orderform.html` 원본과 대조 (2020년 기본 템플릿 기준으로 작성됨). 카페24 관리자에 로그인해 두면 Claude 가 직접 확인 가능.
