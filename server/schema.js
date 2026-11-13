// 설정 스키마: 관리 화면과 스킨 스크립트가 공유하는 "정답" 목록
export const PAYMETHODS = [
  { code: 'card',      label: '신용카드',           group: 'normal' },
  { code: 'tcash',     label: '계좌이체 (토스 퀵계좌이체)', group: 'normal' },
  { code: 'cash',      label: '무통장입금',          group: 'normal' },
  { code: 'icash',     label: '가상계좌',            group: 'normal' },
  { code: 'cell',      label: '휴대폰 결제',          group: 'normal' },
  { code: 'naverpay',  label: '네이버페이',           group: 'simple' },
  { code: 'kakaopay',  label: '카카오페이',           group: 'simple' },
  { code: 'tosspay',   label: '토스페이',             group: 'simple' },
  { code: 'payco',     label: '페이코',               group: 'simple' },
  { code: 'smilepay',  label: '스마일페이',           group: 'simple' },
  { code: 'samsungpay',label: '삼성페이',             group: 'simple' },
  { code: 'applepay',  label: '애플페이',             group: 'simple' },
  { code: 'kpay',      label: 'K페이',                group: 'simple' },
  { code: 'paynow',    label: '페이나우',             group: 'simple' },
  { code: 'deferpay',  label: '후불결제',             group: 'normal' },
];

export const NOTICE_POSITIONS = [
  { code: 'shippingInfo',     label: '배송지 하단' },
  { code: 'hopeShippingDate', label: '희망배송시간 하단' },
  { code: 'subscriptionStartDate', label: '정기 배송 하단' },
  { code: 'orderProduct',     label: '주문상품 하단' },
  { code: 'discount',         label: '할인/부가결제 하단' },
  { code: 'additionalInput',  label: '추가 입력 하단' },
  { code: 'paymethod',        label: '결제수단 하단' },
  { code: 'gift',             label: '사은품 하단' },
  { code: 'benefit',          label: '적립금(적립 혜택) 하단' },
];

export const PROMOTION_POSITIONS = [
  { code: 'default', label: '기본 (결제수단 위)' },
  { code: 'top',     label: '주문서 맨 위' },
  { code: 'bottom',  label: '결제 버튼 바로 위' },
];

export const PAYMETHOD_MODES = [
  { code: 'mixed', label: '혼합형 (간편결제 버튼 + 일반결제 카드)' },
  { code: 'card',  label: '카드형 (전부 큰 버튼)' },
  { code: 'list',  label: '목록형 (전부 한 줄 목록)' },
];

export const DEFAULT_CONFIG = {
  version: 1,
  enabled: true,
  theme: { mainColor: '#000000', subColor: '#000000', round: true },
  logo: { visible: false, url: '', heightPc: 24, heightMo: 24 },
  // fillPayer: 계좌이체 예금주명·무통장 입금자명을 받는 분 이름으로 미리 채움. fillPayerLive=false 면 테스트 스킨에서만
  paymethod: { mode: 'mixed', order: 'simple_first', fillPayer: true, fillPayerLive: false },
  badges: [],
  benefitMsgs: [],
  installment: { visible: false, title: '무이자 할부 안내', items: [] },
  coupon: { autoSelect: true, showNoCoupon: false },
  couponWindow: { custom: true, defaultTab: 'available', showUnavailable: true, showNotices: true, notices: [] },
  points: { title: '', summary: true, summaryText: '이번 주문으로 {amount} 적립 예정', hideSection: true, maxUseText: '현재 사용 가능한 최대 적립금은 {amount}입니다.' },
  notices: [],
  promotion: { type: 'text', position: 'default', items: [], images: [] },
  deliveryTimer: { visible: false, cutoff: '15:00', holidays: [], showNextDay: true, accentColor: '#F51A1A',
    text: '{time} 안에 결제하면 오늘출발 상품은 <b>오늘 출발</b>해요', textAfter: '지금 주문하면 오늘출발 상품은 <b>{date}</b> 출발해요' },
  discountCode: { mode: 'collapse', collapse: true, linkText: '할인코드가 있어요' },
  guestNudge: { visible: true, title: '네이버 · 카카오로 3초 만에 로그인', body: '로그인하면 쿠폰과 적립금을 쓸 수 있고, 주문조회 비밀번호를 만들 필요가 없어요.', linkText: '로그인하고 주문하기' },
  freeShipping: { visible: false, threshold: 70000, basis: 'after', gapUnder: 30000, linkToCart: true,
    text: '{gap}원만 더 담으면 배송비 {fee}이 무료예요', doneText: '무료배송 적용됨', linkText: '장바구니' },
  // 사용 기록(track.js): 장바구니·주문서에서 누른 버튼·금액을 Supabase shop_events 에 쌓는다. live=false 면 테스트 스킨 주소에서만
  tracking: { enabled: true, live: false, url: 'https://eeffmbusaqaadeojjlnc.supabase.co/rest/v1/rpc/shop_track', key: '' },
  // 장바구니 (basket.js). 무료배송 기준 금액·계산 방식·안내 상한(gapUnder)은 위 freeShipping 값을 같이 쓴다.
  basket: {
    enabled: true,
    selectAll: true,
    orderBar: { visible: true, text: '{amount}원 주문하기', allLabel: '전체 {count}개', selectLabel: '선택 {count}개', noneButton: '상품을 선택해 주세요', noneText: '주문할 상품을 선택해 주세요.' },
    freeShipBar: { visible: true, text: '<b>{gap}원</b>만 더 담으면 <b>무료배송</b>', doneText: '무료배송 조건을 채웠어요', barText: '무료배송까지 {gap}원', barDoneText: '무료배송' },
    recommend: { visible: true, cateNo: 0, title: '함께 담으면 무료배송', max: 8, fillTag: '담으면 무료배송',
      // 장바구니 안에서 옵션 골라 바로 담기. live=false 면 테스트 스킨 주소에서만
      quickAdd: { enabled: true, live: false } },
    guestBenefit: { visible: true, title: '로그인하면 회원 할인가로 주문할 수 있어요', body: '', linkText: '로그인' },
    hideButtons: { estimate: true, oversea: true },
    // 금액 안내: 버튼 아래 문구 + 합계에 할인 금액 줄. live=false 면 테스트 스킨 주소에서만
    priceNote: { visible: true, live: false, text: '쿠폰/적립금 적용 시 결제 금액은 상이할 수 있습니다', discountLine: true, discountLabel: '할인 금액' },
    // 2단계 화면 정리. live=false 이면 테스트 스킨 주소(/skin-…)에서만 켜지고 손님 화면(대표 스킨)은 그대로.
    tidy: { enabled: true, live: false, compactTop: true, compactItems: true, optionChange: true, autoQuantity: true, hideGuide: true, giftBelow: true },
  },
};

// 깊은 병합: 저장된 설정에 빠진 항목은 기본값으로 채운다
export function withDefaults(cfg) {
  const out = structuredClone(DEFAULT_CONFIG);
  const merge = (dst, src) => {
    if (!src || typeof src !== 'object') return;
    for (const k of Object.keys(src)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (Array.isArray(src[k])) dst[k] = structuredClone(src[k]);
      else if (src[k] && typeof src[k] === 'object') { dst[k] = dst[k] && typeof dst[k] === 'object' ? dst[k] : {}; merge(dst[k], src[k]); }
      else dst[k] = src[k];
    }
  };
  merge(out, cfg);
  return out;
}
