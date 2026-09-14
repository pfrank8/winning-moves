# Winning Moves

A static game theory site for one reader (Garrett, 9, a math savant). 21
chapters, each with playable games against a perfect-play robot ("Robo") and
real mathematics. Published with GitHub Pages from `docs/`.

## Layout

- `content/site.json`: parts, chapter order, dedication, custom domain.
- `content/chapters/<slug>.html`: chapter fragment with JSON front matter.
- `content/pages/*.html`: home (`index`), `glossary`, `arcade`, `grown-ups`.
- `assets/site.css`, `assets/site.js`: the shared design system and runtime (`window.WM`).
- `assets/ch/<slug>.js`: per-chapter script, loaded after `site.js`.
- `templates/page.html`: the page shell.
- `build.py`: assembles `docs/`. `python3 build.py --check` also verifies internal links.
- `docs/`: built output, committed, served by GitHub Pages. Never hand-edit.
- `CHAPTER_SPEC.md`: the authoring spec. Read it before touching any chapter.

## Rules

- Build after every content change and commit `docs/` with the source.
- Colors mean things site-wide: red = reader, blue = Robo, yellow = math, green = win.
- No em-dashes in any copy. No emoji decoration.
- Perfect play must be computed, never faked.
- Stars (`WM.earn`) are for genuinely clever actions only.
- Verify a chapter by rendering it headless (Chrome `--headless=new --screenshot`) and looking.

## Deploy

Hosting is Netlify (free tier), site name `winning-moves`
(https://winning-moves.netlify.app), on the Netlify team that belongs to
peter.franklin@gmail.com ("my team", my-team-vvih-ds). Custom domain:
https://gametheory.primori.com (DNS at Namecheap: CNAME `gametheory` ->
`winning-moves.netlify.app`, plus a `subdomain-owner-verification` TXT that
Netlify required because primori.com itself is registered to a different
Netlify account). Deploy = `scripts/deploy.sh` (build, smoke test, `netlify deploy --prod
--dir docs`); it needs a one-time `netlify login` + `netlify link --name
winning-moves`. Fallback without the CLI: zip `docs/` and drop it on the
project's "Production deploys" panel at
https://app.netlify.com/projects/winning-moves/deploys. GitHub Pages (`.github/workflows/pages.yml`) is a fallback only; the
pfrank8 account was billing-locked on 2026-09-14 so it could not build. Never
host this under a company org (Peter, 2026-09-14).

## Verifying

- `python3 scripts/smoke.py` (needs the Python `playwright` package, present on
  this machine) loads every built page, clicks every button, moves every
  slider, and fails on any JS error; `--phone` also fails on horizontal
  overflow at 400px; `--only slug,slug` narrows it; `--out DIR` points it at a
  private build.
- Parallel authors build with `python3 build.py --out .scratch/<slug>/out` so
  they never touch the shared `docs/`.
