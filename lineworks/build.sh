#!/usr/bin/env bash
# Builds lineworks/index.html from the single-file game source (game.html).
# Usage: ./build.sh   (run from this folder)
set -euo pipefail
cd "$(dirname "$0")"
{
  printf '%s\n' '<!doctype html>' '<html lang="en">' '<head>' \
    '<meta charset="utf-8">' \
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' \
    '<meta name="theme-color" content="#f1f0ea">' \
    '<meta name="apple-mobile-web-app-capable" content="yes">' \
    '<meta name="mobile-web-app-capable" content="yes">' \
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">' \
    '<meta name="apple-mobile-web-app-title" content="Lineworks">' \
    '<link rel="manifest" href="manifest.webmanifest">' \
    '<link rel="apple-touch-icon" href="apple-touch-icon.png">' \
    '<link rel="icon" href="icon-192.png">' \
    '</head>' '<body>'
  cat game.html
  printf '%s\n' "<script>if('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>" '</body>' '</html>'
} > index.html
echo "Built index.html ($(wc -c < index.html) bytes)"
