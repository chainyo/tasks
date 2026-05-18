#!/usr/bin/env bash
set -euo pipefail

if ! command -v tauri-pilot >/dev/null 2>&1; then
  echo "tauri-pilot CLI is required. Install it with: cargo install tauri-pilot-cli"
  exit 1
fi

tauri-pilot ping
tauri-pilot --window main snapshot -i
tauri-pilot --window main assert visible 'button[aria-label="Open task settings"]'
tauri-pilot --window main click 'button[aria-label="Open task settings"]'
tauri-pilot --window config wait --selector 'input[aria-label="Daily task 1"]'
tauri-pilot --window config fill 'input[aria-label="Daily task 1"]' "Review the daily plan"
tauri-pilot --window config click 'button[type="submit"]'
tauri-pilot --window config wait --selector '[role="status"]'
