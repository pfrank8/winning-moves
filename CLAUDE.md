# Winning Moves

A static game theory site for one reader (Garrett, 9, a math savant). 21
chapters, each with playable games against a perfect-play robot ("Robo") and
real mathematics. Built into `docs/` and served at https://east11ventures.com/gametheory/
(see Deploy).

## Layout

- `content/site.json`: parts, chapter order, dedication, custom domain.
- `content/chapters/<slug>.html`: chapter fragment with JSON front matter.
- `content/pages/*.html`: home (`index`), `glossary`, `arcade`, `grown-ups`.
- `assets/site.css`, `assets/site.js`: the shared design system and runtime (`window.WM`).
- `assets/ch/<slug>.js`: per-chapter script, loaded after `site.js`.
- `templates/page.html`: the page shell.
- `build.py`: assembles `docs/`. `python3 build.py --check` also verifies internal links.
- `docs/`: built output, committed, published to Netlify by `scripts/deploy.sh`. Never hand-edit.
- `CHAPTER_SPEC.md`: the authoring spec. Read it before touching any chapter.

## Rules

- Build after every content change and commit `docs/` with the source.
- Colors mean things site-wide: red = reader, blue = Robo, yellow = math, green = win.
- No em-dashes in any copy. No emoji decoration.
- Perfect play must be computed, never faked.
- Stars (`WM.earn`) are for genuinely clever actions only.
- Every game board follows the Game UX contract in `CHAPTER_SPEC.md` (a "your move" strip, the
  thing the rules name is the thing you click, controls above the play area, nothing needed is
  hidden). `python3 scripts/ux_audit.py` is the gate; it also writes a screenshot of every board.
- Verify a chapter by rendering it headless (Chrome `--headless=new --screenshot`) and looking.

## Deploy

Public URL: **https://east11ventures.com/gametheory/** (Peter, 2026-09-20: host it on the
East 11 site, not primori.com). How that works:

- This repo publishes to its own Netlify project, `gametheory-east11` (id
  50e354f7-94b8-4d11-b9cc-cc8739e18172, https://gametheory-east11.netlify.app), on the East 11
  team (`east11`, slug `peter-jmo8kve`, login peter@east11ventures.com; East 11 is Primori Global
  LLC's dba, so this is Peter's own account). The repo directory is netlify-linked
  (`.netlify/state.json`, gitignored).
- The East 11 site (`~/github/primori/east11`, `netlify.toml`) proxies `/gametheory/*` to that
  project with a status-200 rewrite. No DNS is involved. Do not add a real `gametheory/` folder to
  the east11 repo: it would shadow the proxy.
- Every link in this site is relative, which is what lets it live under a sub-path. Keep it that
  way: no root-relative (`/assets/...`) URLs, ever. The home page carries a tiny guard
  (`MOUNT_GUARD` in `build.py`) that adds the trailing slash when someone types `/gametheory`.
- Netlify post-processing must stay OFF for this project (`[build.processing]` in `netlify.toml`
  plus the project's `processing_settings.html.pretty_urls = false`). With "pretty URLs" on,
  Netlify rewrites `./hex.html` into the root-relative `/hex` at deploy time. That is invisible
  locally and at a domain root, and it broke every chapter link under `/gametheory/` on
  2026-09-20.
- Deploy = `scripts/deploy.sh`: build, smoke test, `netlify deploy --prod --dir docs`, then
  `scripts/verify_live.py`, which crawls the PUBLIC url and fails on any link or asset that
  escapes the sub-path. Needs the CLI logged in as the East 11 user (`netlify login`).

Leftovers from 2026-09-14, harmless, to retire when convenient: a first copy of the site on the
free Netlify team of peter.franklin@gmail.com (project `winning-moves`), which
gametheory.primori.com (a Namecheap CNAME) still points at. GitHub Pages
(`.github/workflows/pages.yml`) is a fallback only. Never host this under a company org other than
Peter's own (Peter, 2026-09-14).

## Verifying

- `python3 scripts/smoke.py` (needs the Python `playwright` package, present on
  this machine) loads every built page, clicks every button, moves every
  slider, and fails on any JS error; `--phone` also fails on horizontal
  overflow at 400px; `--only slug,slug` narrows it; `--out DIR` points it at a
  private build.
- `python3 scripts/verify_live.py` checks the deployed site (25 pages, all assets, no link
  leaving `/gametheory/`). The local smoke test cannot see deploy-time rewrites; this can.
- Parallel authors build with `python3 build.py --out .scratch/<slug>/out` so
  they never touch the shared `docs/`.
