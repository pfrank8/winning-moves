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

`git push` to `main`. GitHub Pages serves `docs/`. The custom domain (if any)
is `domain` in `content/site.json`, which writes `docs/CNAME`.
