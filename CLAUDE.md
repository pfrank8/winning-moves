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

Hosting is Netlify, on the East 11 team (`east11`, slug `peter-jmo8kve`,
login peter@east11ventures.com; East 11 is Primori Global LLC's dba, so this is
Peter's own account). Site `gametheory-primori` (id
50e354f7-94b8-4d11-b9cc-cc8739e18172, https://gametheory-primori.netlify.app),
custom domain https://gametheory.primori.com. The repo directory is linked
(`.netlify/state.json`, gitignored), so `scripts/deploy.sh` publishes with
`netlify deploy --prod --dir docs` after the build and smoke tests. DNS for
primori.com is Namecheap BasicDNS: CNAME `gametheory` -> the site's
netlify.app hostname, plus the `subdomain-owner-verification` TXT Netlify asked
for on 2026-09-14. A first copy of the site lived on the free team of
peter.franklin@gmail.com (site `winning-moves`); it is being retired. GitHub
Pages (`.github/workflows/pages.yml`) is a fallback only. Never host this under
a company org other than Peter's own (Peter, 2026-09-14).

## Verifying

- `python3 scripts/smoke.py` (needs the Python `playwright` package, present on
  this machine) loads every built page, clicks every button, moves every
  slider, and fails on any JS error; `--phone` also fails on horizontal
  overflow at 400px; `--only slug,slug` narrows it; `--out DIR` points it at a
  private build.
- Parallel authors build with `python3 build.py --out .scratch/<slug>/out` so
  they never touch the shared `docs/`.
