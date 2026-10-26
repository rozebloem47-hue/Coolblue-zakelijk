#!/bin/bash
# Controleert elke beeldverwijzing in src/data/media.ts op het Coolblue-CDN.
# Laag tempo: het CDN blokkeert kort bij te veel gelijktijdige verzoeken.
UA='Mozilla/5.0 (compatible; ClaudeCodeAgent/1.0)'
out=${1:-/opt/build/repo/.netlify/photo-check.txt}
: > "$out"
grep -oE "'[0-9a-f]{32}'" src/data/media.ts | tr -d "'" | sort -u | while read -r hash; do
  code=$(curl -sSL -o /dev/null -w '%{http_code}' -A "$UA" --max-time 20 \
    "https://image.coolblue.nl/transparent/max/480xauto/content/$hash")
  echo "content $hash $code" >> "$out"
  sleep 0.4
done
grep -oE "':'[0-9]{4,}'" src/data/media.ts | grep -oE "[0-9]{4,}" | sort -u | while read -r id; do
  code=$(curl -sSL -o /dev/null -w '%{http_code}' -A "$UA" --max-time 20 \
    "https://image.coolblue.nl/transparent/max/500xauto/products/$id")
  echo "product $id $code" >> "$out"
  sleep 0.4
done
echo "klaar: $(wc -l < "$out") verwijzingen" >> "$out"
