#!/bin/zsh
cd "$(dirname "$0")"
echo "다나로브 주문서 꾸미기 관리 화면을 켭니다… (끄려면 이 창을 닫으세요)"
open "http://localhost:3006" &
exec /usr/local/bin/node server/index.js
