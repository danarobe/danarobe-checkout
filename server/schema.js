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
  theme: { mainColor: '#000000', subColor: '#000000', round: true },
  logo: { visible: false, url: '', heightPc: 24, heightMo: 24 },
  paymethod: { mode: 'mixed', order: 'simple_first' },
  badges: [],
  benefitMsgs: [],
  installment: { visible: false, title: '무이자 할부 안내', items: [] },
  coupon: { autoSelect: true, showNoCoupon: false },
  couponWindow: { defaultTab: 'available', showUnavailable: true, showNotices: true, notices: [] },
  points: { title: '' },
  notices: [],
  promotion: { type: 'text', position: 'default', items: [], images: [] },
  deliveryTimer: { visible: false, cutoff: '13:00', holidays: [], showNextDay: true, accentColor: '#F51A1A' },
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
