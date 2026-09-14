#!/usr/bin/env python3
"""Build the Winning Moves static site.

Reads content/site.json (parts + chapter order), content/chapters/<slug>.html
(chapter fragments with a JSON front-matter comment), content/pages/*.html
(top-level pages), and templates/page.html, then writes the finished site to
docs/ (the GitHub Pages source folder). No third-party dependencies.

Usage: python3 build.py            # build to docs/
       python3 build.py --check    # build, then fail on broken internal links
       python3 build.py --out DIR  # build somewhere else (parallel authors use .scratch/<slug>/out)
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
CHAPTERS_DIR = CONTENT / "chapters"
PAGES_DIR = CONTENT / "pages"
ASSETS = ROOT / "assets"
TEMPLATE = ROOT / "templates" / "page.html"
OUT = ROOT / "docs"

META_RE = re.compile(r"^\s*<!--meta\s*(\{.*?\})\s*-->", re.S)
ROMANS = ["I", "II", "III", "IV", "V", "VI"]


@dataclass(frozen=True)
class Star:
    id: str
    label: str


@dataclass
class Chapter:
    slug: str
    title: str
    kicker: str
    description: str
    lede: str
    stars: list[Star]
    body: str
    num: int = 0
    part_index: int = 0
    part_title: str = ""

    @property
    def href(self) -> str:
        return f"{self.slug}.html"


@dataclass
class Part:
    roman: str
    title: str
    blurb: str
    chapters: list[Chapter] = field(default_factory=list)


@dataclass
class Page:
    slug: str
    title: str
    description: str
    body: str
    main_class: str = "page"


@dataclass
class Site:
    title: str
    tagline: str
    dedication: str
    domain: str
    parts: list[Part]

    @property
    def chapters(self) -> list[Chapter]:
        return [c for p in self.parts for c in p.chapters]


def parse_fragment(path: Path) -> tuple[dict[str, object], str]:
    text = path.read_text(encoding="utf-8")
    m = META_RE.match(text)
    if not m:
        raise SystemExit(f"{path}: missing <!--meta {{...}} --> front matter")
    meta = json.loads(m.group(1))
    body = text[m.end():].strip("\n")
    return meta, body


def load_chapter(slug: str) -> Chapter:
    path = CHAPTERS_DIR / f"{slug}.html"
    if not path.exists():
        print(f"WARNING: chapter fragment missing, building a placeholder: {path.name}")
        title = slug.replace("-", " ").capitalize()
        return Chapter(slug=slug, title=title, kicker="", description="This chapter is still being written.",
                       lede="This chapter is still being written.", stars=[],
                       body='<div class="prose"><p>Coming soon.</p></div>')
    meta, body = parse_fragment(path)
    raw_stars = meta.get("stars", [])
    if not isinstance(raw_stars, list):
        raise SystemExit(f"{path}: 'stars' must be a list")
    stars = [Star(id=str(s["id"]), label=str(s["label"])) for s in raw_stars]
    return Chapter(
        slug=slug,
        title=str(meta["title"]),
        kicker=str(meta.get("kicker", "")),
        description=str(meta.get("description", "")),
        lede=str(meta.get("lede", "")),
        stars=stars,
        body=body,
    )


def load_site() -> Site:
    raw = json.loads((CONTENT / "site.json").read_text(encoding="utf-8"))
    parts: list[Part] = []
    num = 0
    for i, p in enumerate(raw["parts"]):
        part = Part(roman=ROMANS[i], title=str(p["title"]), blurb=str(p.get("blurb", "")))
        for slug in p["chapters"]:
            num += 1
            ch = load_chapter(str(slug))
            ch.num = num
            ch.part_index = i
            ch.part_title = part.title
            part.chapters.append(ch)
        parts.append(part)
    return Site(
        title=str(raw["title"]),
        tagline=str(raw.get("tagline", "")),
        dedication=str(raw.get("dedication", "")),
        domain=str(raw.get("domain", "")),
        parts=parts,
    )


def star_svg(cls: str = "") -> str:
    c = f' class="{cls}"' if cls else ""
    return (f'<svg{c} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6'
            f'L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>')


def chapters_json(site: Site) -> str:
    data = [
        {"slug": c.slug, "num": c.num, "title": c.title, "stars": [{"id": s.id, "label": s.label} for s in c.stars]}
        for c in site.chapters
    ]
    return json.dumps(data, separators=(",", ":"))


def render_template(template: str, values: dict[str, str]) -> str:
    out = template
    for k, v in values.items():
        out = out.replace("{{" + k + "}}", v)
    leftover = re.findall(r"\{\{(\w+)\}\}", out)
    if leftover:
        raise SystemExit(f"unfilled template slots: {sorted(set(leftover))}")
    return out


def pager_html(site: Site, ch: Chapter) -> str:
    chapters = site.chapters
    i = chapters.index(ch)
    prev_c = chapters[i - 1] if i > 0 else None
    next_c = chapters[i + 1] if i + 1 < len(chapters) else None
    if prev_c:
        prev = f'<a class="prev" href="{prev_c.href}"><span class="lab">← Chapter {prev_c.num}</span><span class="t">{prev_c.title}</span></a>'
    else:
        prev = '<a class="prev" href="./"><span class="lab">← Home</span><span class="t">All chapters</span></a>'
    if next_c:
        nxt = f'<a class="next" href="{next_c.href}"><span class="lab">Chapter {next_c.num} →</span><span class="t">{next_c.title}</span></a>'
    else:
        nxt = '<a class="next" href="glossary.html"><span class="lab">Next →</span><span class="t">Big words</span></a>'
    return f'<nav class="pager" aria-label="Chapters">{prev}{nxt}</nav>'


def chapter_stars_html(ch: Chapter) -> str:
    if not ch.stars:
        return ""
    items = "".join(f'<li data-star="{s.id}">{star_svg()}<span>{s.label}</span></li>' for s in ch.stars)
    return (f'<section class="chapter-stars"><h3>Stars in this chapter</h3>'
            f'<p class="note" style="margin-top:0">Earn them by doing the clever thing, not by clicking around.</p>'
            f'<ul class="starlist">{items}</ul></section>')


def chapter_page(site: Site, ch: Chapter, template: str, build_id: str) -> str:
    part = site.parts[ch.part_index]
    head = (f'<header class="chapter-head part-{ch.part_index + 1}"><div class="num">{ch.num}</div>'
            f'<div><span class="kicker">Part {part.roman} · {part.title}</span><h1>{ch.title}</h1>'
            f'<p class="lede">{ch.lede}</p></div></header>')
    body = head + ch.body + chapter_stars_html(ch)
    script_path = ASSETS / "ch" / f"{ch.slug}.js"
    scripts = f'<script src="assets/ch/{ch.slug}.js?v={build_id}"></script>' if script_path.exists() else ""
    return render_template(template, {
        "title": f"{ch.num}. {ch.title}",
        "description": ch.description,
        "root": "./",
        "build": build_id,
        "chapters_json": chapters_json(site),
        "body_class": f"chapter-{ch.slug}",
        "crumb": f"Part {part.roman} · Chapter {ch.num}",
        "main_class": "chapter",
        "body": body,
        "pager": pager_html(site, ch),
        "scripts": scripts,
    })


BOARD_RE = re.compile(r'<div class="board"(?![^>]*\bid=)([^>]*)>(\s*<div class="board-head">\s*<h3>)(.*?)(</h3>)', re.S)


@dataclass(frozen=True)
class Board:
    chapter: Chapter
    title: str
    anchor: str


def anchor_boards(ch: Chapter) -> list[Board]:
    """Give every game board in a chapter an id, and return the list for the Arcade."""
    boards: list[Board] = []
    counter = 0

    def repl(m: re.Match[str]) -> str:
        nonlocal counter
        counter += 1
        anchor = f"board-{counter}"
        boards.append(Board(chapter=ch, title=re.sub(r"<[^>]+>", "", m.group(3)).strip(), anchor=anchor))
        return f'<div class="board" id="{anchor}"{m.group(1)}>{m.group(2)}{m.group(3)}{m.group(4)}'

    ch.body = BOARD_RE.sub(repl, ch.body)
    return boards


def arcade_html(boards: list[Board]) -> str:
    cards = "".join(
        f'<li><a class="card" href="{b.chapter.href}#{b.anchor}"><span class="n">Chapter {b.chapter.num} · {b.chapter.title}</span>'
        f'<h3>{b.title}</h3><p>{b.chapter.description}</p></a></li>' for b in boards)
    return f'<ul class="cards">{cards}</ul>'


def chapter_map_html(site: Site) -> str:
    out: list[str] = []
    for part in site.parts:
        cards: list[str] = []
        for ch in part.chapters:
            ids = ",".join(s.id for s in ch.stars)
            stars = "".join(star_svg() for _ in ch.stars)
            cards.append(
                f'<li><a class="card" href="{ch.href}"><span class="n">Chapter {ch.num}</span><h3>{ch.title}</h3>'
                f'<p>{ch.description}</p><span class="stars" data-chapter-stars="{ids}">{stars}</span></a></li>')
        out.append(
            f'<section class="part"><div class="part-head"><span class="roman">Part {part.roman}</span><h2>{part.title}</h2></div>'
            f'<p class="part-blurb">{part.blurb}</p><ul class="cards">{"".join(cards)}</ul></section>')
    return "".join(out)


def page_page(site: Site, page: Page, template: str, build_id: str, boards: list[Board]) -> str:
    body = page.body.replace("{{chapter_map}}", chapter_map_html(site))
    body = body.replace("{{arcade}}", arcade_html(boards))
    body = body.replace("{{dedication}}", site.dedication)
    body = body.replace("{{tagline}}", site.tagline)
    script_path = ASSETS / "ch" / f"{page.slug}.js"
    scripts = f'<script src="assets/ch/{page.slug}.js?v={build_id}"></script>' if script_path.exists() else ""
    return render_template(template, {
        "title": page.title,
        "description": page.description,
        "root": "./",
        "build": build_id,
        "chapters_json": chapters_json(site),
        "body_class": f"page-{page.slug}",
        "crumb": page.title if page.slug != "index" else site.tagline,
        "main_class": page.main_class,
        "body": body,
        "pager": "",
        "scripts": scripts,
    })


def load_pages() -> list[Page]:
    pages: list[Page] = []
    for path in sorted(PAGES_DIR.glob("*.html")):
        meta, body = parse_fragment(path)
        pages.append(Page(slug=path.stem, title=str(meta["title"]), description=str(meta.get("description", "")),
                          body=body, main_class=str(meta.get("main_class", "page"))))
    return pages


def check_links(out_dir: Path) -> int:
    """Return the number of broken internal hrefs/srcs across built pages."""
    bad = 0
    for html in out_dir.glob("*.html"):
        text = html.read_text(encoding="utf-8")
        for m in re.finditer(r'(?:href|src)="([^"#?]+)', text):
            target = m.group(1)
            if target.startswith(("http", "mailto:", "data:")) or target in ("./", "/"):
                continue
            if not (out_dir / target).exists():
                print(f"BROKEN {html.name}: {target}")
                bad += 1
    return bad


def main(argv: list[str]) -> int:
    global OUT
    if "--out" in argv:
        OUT = Path(argv[argv.index("--out") + 1]).resolve()
    site = load_site()
    template = TEMPLATE.read_text(encoding="utf-8")
    digest = hashlib.sha1()
    for p in sorted(list(ASSETS.rglob("*")) + list(CHAPTERS_DIR.glob("*")) + list(PAGES_DIR.glob("*")) + [TEMPLATE]):
        if p.is_file():
            digest.update(p.read_bytes())
    build_id = digest.hexdigest()[:8]

    if OUT.exists():
        for child in OUT.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copytree(ASSETS, OUT / "assets")
    (OUT / ".nojekyll").write_text("", encoding="utf-8")
    if site.domain:
        (OUT / "CNAME").write_text(site.domain + "\n", encoding="utf-8")

    boards: list[Board] = []
    for ch in site.chapters:
        boards.extend(anchor_boards(ch))
        (OUT / ch.href).write_text(chapter_page(site, ch, template, build_id), encoding="utf-8")
    for page in load_pages():
        (OUT / f"{page.slug}.html").write_text(page_page(site, page, template, build_id, boards), encoding="utf-8")

    print(f"built {len(site.chapters)} chapters + {len(list(PAGES_DIR.glob('*.html')))} pages -> {OUT} (build {build_id})")
    if "--check" in argv:
        bad = check_links(OUT)
        if bad:
            print(f"{bad} broken link(s)")
            return 1
        print("links ok")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
