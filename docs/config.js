/* 다나로브 주문서 설정 — 관리 화면에서 생성됨 (2026-10-29T13:49:02.855Z) */
window.DNRB_PAY_CONFIG = {
  "version": 1,
  "enabled": true,
  "theme": {
    "mainColor": "#605043",
    "subColor": "#605043",
    "round": true
  },
  "logo": {
    "visible": true,
    "url": "https://wnqka5000.cafe24.com/web/upload/category/editor/2026/07/06/47cb97420ffb8280d3610fd004895ad1.png",
    "heightPc": 24,
    "heightMo": 24
  },
  "paymethod": {
    "mode": "mixed",
    "order": "simple_first"
  },
  "badges": [
    {
      "visible": true,
      "method": "tcash",
      "text": "0.3% 무제한 즉시할인",
      "color": "#267BFF"
    }
  ],
  "benefitMsgs": [],
  "installment": {
    "visible": false,
    "title": "무이자 할부 안내",
    "items": []
  },
  "coupon": {
    "autoSelect": true,
    "showNoCoupon": false
  },
  "couponWindow": {
    "custom": true,
    "defaultTab": "available",
    "showUnavailable": true,
    "showNotices": true,
    "notices": [
      "보유한 쿠폰 중 적용 가능한 쿠폰만 표시됩니다.",
      "최소 사용 금액은 쿠폰마다 다를 수 있습니다. 쿠폰 상세 내역을 확인해주세요.",
      "추가쿠폰은 최대사용개수와 상관없이 상품 쿠폰과 주문서 쿠폰을 각각 1개씩 추가로 사용할 수 있는 쿠폰입니다.",
      "쿠폰 정책과 관련해서는, NOTICE  게시판을 참고해주세요 ♥"
    ]
  },
  "points": {
    "title": "",
    "summary": true,
    "summaryText": "이번 주문으로 {amount} 적립 예정",
    "hideSection": true,
    "maxUseText": "현재 사용 가능한 최대 적립금은 {amount}입니다."
  },
  "notices": [],
  "promotion": {
    "type": "text",
    "position": "default",
    "items": [],
    "images": []
  },
  "deliveryTimer": {
    "visible": true,
    "cutoff": "15:00",
    "holidays": [],
    "showNextDay": true,
    "accentColor": "#F51A1A",
    "text": "{time} 안에 결제하면 오늘출발 상품은 <b>오늘 출발</b>해요",
    "textAfter": "지금 주문하면 오늘출발 상품은 <b>{date}</b> 출발해요"
  },
  "discountCode": {
    "collapse": true,
    "linkText": "할인코드가 있어요"
  },
  "guestNudge": {
    "visible": true,
    "title": "네이버 · 카카오로 3초 만에 로그인",
    "body": "로그인하면 쿠폰과 적립금을 쓸 수 있고, 주문조회 비밀번호를 만들 필요가 없어요.",
    "linkText": "로그인하고 주문하기"
  },
  "freeShipping": {
    "visible": true,
    "threshold": 70000,
    "basis": "after",
    "gapUnder": 30000,
    "linkToCart": true,
    "text": "{gap}원만 더 담으면 배송비 {fee}이 무료예요",
    "doneText": "무료배송 적용됨",
    "linkText": "장바구니"
  }
};
