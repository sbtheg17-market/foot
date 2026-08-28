#!/bin/bash
# fetch_vsc.sh <remote-path> [local-out]
V=https://vscode-2ff9b84c-3807-401c-81a6-61315a05953a.preview.emergentagent.com
CK='code-server-session=%24argon2id%24v%3D19%24m%3D65536%2Ct%3D3%2Cp%3D4%24j3ifKx1gn18nVGmzWm7ZwQ%24f88ZoXjRZyNtocIDEMBFcCGLAOUUlt1%2BWRztqm2sWUU'
ST=stable-88c2b7432e938f6918f21ff8d9dbfc641cd933d0
P="$1"; OUT="$2"
if [ -n "$OUT" ]; then
  code=$(curl -sk -H "Cookie: $CK" "$V/$ST/vscode-remote-resource?path=$P" -o "$OUT" -w "%{http_code}")
  echo "$code $P"
else
  curl -sk -H "Cookie: $CK" "$V/$ST/vscode-remote-resource?path=$P"
fi
