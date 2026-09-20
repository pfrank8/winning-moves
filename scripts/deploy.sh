#!/bin/bash
# Build, verify (smoke, phone smoke, game UX gate), and publish docs/ to the Netlify project "gametheory-east11" (East 11 team),
# which east11ventures.com/gametheory/ proxies to. Then check the PUBLIC url, because a link
# that escapes the sub-path is invisible to the local smoke test.
# One-time setup on a new machine: `netlify login` (opens a browser; click Authorize),
# then `netlify link --name gametheory-east11` from this directory.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 build.py --check
python3 scripts/smoke.py
python3 scripts/smoke.py --phone
python3 scripts/ux_audit.py --no-shots   # every game board says what to do and lets you do it (CHAPTER_SPEC.md, Game UX contract)
if ! netlify status >/dev/null 2>&1; then
  echo "Netlify CLI is not logged in. Run: netlify login   (then re-run this script)" >&2
  exit 1
fi
netlify deploy --prod --dir docs --message "$(git log -1 --pretty=%s)"
python3 scripts/verify_live.py
