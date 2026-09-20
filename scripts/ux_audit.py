#!/usr/bin/env python3
"""Game UX gate: does every game board tell the reader what to do, and let them do it without hunting?

Born 2026-09-20 from Peter's feedback on "Share or Grab?": the board said "You pick the row" but the
rows were not clickable, and the real play buttons were hidden further down. The rules this enforces are
the measurable half of CHAPTER_SPEC.md, "Game UX contract". The other half is looking at the
screenshots this writes to .scratch/ux/shots/.

FAIL (exit 1):
  NO-STRIP        an interactive board has no .turn strip directly under its head
  STRIP-EMPTY     the strip has no instruction text at load
  HIDDEN-CONTROL  a play control (.btn-you, .btn-win, or anything in .controls) is hidden at load
  CONTROL-LOW     a play control sits more than one laptop screen below the top of its board
  GRID-INERT      the rules line says the reader picks a row, but the payoff grid is not clickable
WARN (listed, exit 0):
  TALL            the board is taller than a 1280x800 laptop screen: look at it and try to make it fit
  STRIP-STATIC    (--play) the reader made a first move and the strip did not change: it is decoration,
                  not narration. Some pure tools are legitimately quiet; look before dismissing.

--play makes one real first move on every board (a pickable row, a red button, a clickable cell, a
control button, or a slider nudge), then screenshots the board again as <slug>-<n>-played.png.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
VIEW_H = 800
TOPBAR = 58
FOLD = VIEW_H - TOPBAR - 22   # a control whose bottom is within this of the board top is on screen with the head

PROBE = """
() => [...document.querySelectorAll('div.board')].map(b => {
  const r = b.getBoundingClientRect();
  const shown = e => { const s = getComputedStyle(e), q = e.getBoundingClientRect(); return !e.closest('[hidden]') && s.display !== 'none' && s.visibility !== 'hidden' && q.width > 0 && q.height > 0; };
  const controls = [...b.querySelectorAll('button, input, select, textarea, [role=button], [tabindex="0"]')];
  const pointer = [...b.querySelectorAll('td, th, tr, svg *, [data-r], [data-c]')].filter(e => getComputedStyle(e).cursor === 'pointer');
  const play = [...b.querySelectorAll('.btn-you, .btn-win, .controls button, .controls input, .controls select')];
  const strip = [...b.children].find(e => e.classList.contains('turn'));
  const head = [...b.children].find(e => e.classList.contains('board-head'));
  const pay = b.querySelector('table.pay');
  return {
    title: head && head.querySelector('h3') ? head.querySelector('h3').textContent.trim() : '',
    rules: head && head.querySelector('.rules') ? head.querySelector('.rules').textContent.trim() : '',
    height: Math.round(r.height),
    interactive: controls.length + pointer.length > 0,
    strip: !!strip, strip_after_head: !!(strip && head && head.nextElementSibling === strip),
    strip_text: strip ? strip.textContent.trim() : '',
    hidden_play: play.filter(e => !shown(e)).map(e => (e.textContent || e.id || e.tagName).trim().slice(0, 30)),
    low_play: play.filter(shown).filter(e => e.getBoundingClientRect().bottom - r.top > %FOLD%).map(e => (e.textContent || e.id || e.tagName).trim().slice(0, 30) + ' @' + Math.round(e.getBoundingClientRect().bottom - r.top)),
    has_pay: !!pay,
    pay_clickable: pay ? [...pay.querySelectorAll('td, th, tr')].some(e => getComputedStyle(e).cursor === 'pointer') : false,
  };
})
""".replace("%FOLD%", str(FOLD))


FIRST_MOVE = """
(i) => {
  const b = document.querySelectorAll('div.board')[i];
  const shown = e => { const q = e.getBoundingClientRect(); return !e.closest('[hidden]') && q.width > 0 && q.height > 0 && !e.disabled && getComputedStyle(e).pointerEvents !== 'none'; };
  const groups = [
    'tr.pickable', '.btn-you', 'td.click, td[data-r]', '.cell-grid button', 'svg [data-cell], svg [data-i], svg [data-r], svg .click, svg [role=button]',
    '[role=button]', '.controls button:not(.on)', 'button.btn:not(.on)', 'input[type=number], input[type=text]',
  ];
  for (const sel of groups){
    const els = [...b.querySelectorAll(sel)].filter(shown).filter(e => !/reset|clear|new game|new round|start over/i.test(e.textContent || ''));
    const pointer = els.filter(e => ['BUTTON', 'INPUT'].includes(e.tagName) || getComputedStyle(e).cursor === 'pointer');
    if (pointer.length){ pointer[0].setAttribute('data-ux-first', '1'); return sel; }
  }
  const range = [...b.querySelectorAll('input[type=range]')].filter(shown)[0];
  if (range){ range.setAttribute('data-ux-first', '1'); return 'range'; }
  return null;
}
"""


@dataclass
class BoardReport:
    slug: str
    index: int
    title: str
    height: int
    fails: list[str] = field(default_factory=list)
    warns: list[str] = field(default_factory=list)


def judge(slug: str, index: int, b: dict[str, object]) -> BoardReport:
    rep = BoardReport(slug, index, str(b["title"]), int(str(b["height"])))
    if not b["interactive"]:
        return rep
    if not b["strip"] or not b["strip_after_head"]:
        rep.fails.append("NO-STRIP")
    elif len(str(b["strip_text"])) < 12:
        rep.fails.append("STRIP-EMPTY")
    hidden, low = b["hidden_play"], b["low_play"]
    if isinstance(hidden, list) and hidden:
        rep.fails.append("HIDDEN-CONTROL(" + ", ".join(map(str, hidden[:3])) + ")")
    if isinstance(low, list) and low:
        rep.fails.append("CONTROL-LOW(" + ", ".join(map(str, low[:3])) + ")")
    rules = str(b["rules"]).lower()
    if b["has_pay"] and not b["pay_clickable"] and ("pick the row" in rules or "you pick" in rules or "choose a row" in rules):
        rep.fails.append("GRID-INERT")
    if rep.height > VIEW_H - TOPBAR:
        rep.warns.append(f"TALL({rep.height}px)")
    return rep


def play_first_move(page: Page, i: int, rep: BoardReport, shot: Path | None) -> None:
    """Make one real first move on board i and record whether the strip reacted."""
    strip = page.locator("div.board").nth(i).locator("> .turn")
    before = strip.inner_text()
    kind = page.evaluate(FIRST_MOVE, i)
    if kind is None:
        return
    target = page.locator("[data-ux-first]").first
    try:
        if kind == "range":
            target.focus()
            page.keyboard.press("ArrowRight")
            page.keyboard.press("ArrowRight")
        elif target.evaluate("e => e.tagName") == "INPUT":
            target.fill("7")
            page.keyboard.press("Enter")
        else:
            target.click(timeout=1500, force=True)
    except Exception:  # noqa: BLE001 - a move that cannot land is reported as a static strip below
        pass
    changed = False
    for _ in range(12):
        page.wait_for_timeout(150)
        if strip.inner_text() != before:
            changed = True
            break
    page.evaluate("document.querySelectorAll('[data-ux-first]').forEach(e => e.removeAttribute('data-ux-first'))")
    if not changed:
        rep.warns.append(f"STRIP-STATIC(first move: {kind})")
    if shot is not None:
        page.wait_for_timeout(500)
        page.locator("div.board").nth(i).screenshot(path=str(shot))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=ROOT / "docs", help="built site to audit")
    ap.add_argument("--only", default="", help="comma-separated chapter slugs")
    ap.add_argument("--shots", type=Path, default=ROOT / ".scratch/ux/shots", help="where board screenshots go")
    ap.add_argument("--no-shots", action="store_true")
    ap.add_argument("--play", action="store_true", help="make a first move on every board and check the strip reacts")
    args = ap.parse_args()
    site = json.loads((ROOT / "content/site.json").read_text())
    slugs: list[str] = [s for part in site["parts"] for s in part["chapters"]]
    if args.only:
        wanted = {s.strip() for s in args.only.split(",")}
        slugs = [s for s in slugs if s in wanted]
    args.shots.mkdir(parents=True, exist_ok=True)
    reports: list[BoardReport] = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": VIEW_H})
        for slug in slugs:
            page.goto((args.out / f"{slug}.html").resolve().as_uri(), wait_until="load")
            page.wait_for_timeout(250)
            for i, b in enumerate(page.evaluate(PROBE)):
                reports.append(judge(slug, i, b))
                if not args.no_shots:
                    # hide the sticky top bar so it does not paint over the board in the element screenshot
                    page.add_style_tag(content=".topbar{visibility:hidden}")
                    page.locator("div.board").nth(i).screenshot(path=str(args.shots / f"{slug}-{i}.png"))
                if args.play and b["interactive"] and b["strip"]:
                    play_first_move(page, i, reports[-1], None if args.no_shots else args.shots / f"{slug}-{i}-played.png")
        browser.close()
    bad = [r for r in reports if r.fails]
    for r in reports:
        if r.fails or r.warns:
            print(f"{'FAIL' if r.fails else 'warn'} {r.slug}#{r.index} {r.title[:34]:34s} {' '.join(r.fails + r.warns)}")
    tall = sum(1 for r in reports if any(w.startswith("TALL") for w in r.warns))
    static = sum(1 for r in reports if any(w.startswith("STRIP-STATIC") for w in r.warns))
    print(f"{len(reports)} boards, {len(bad)} failing, {tall} tall" + (f", {static} with a strip that did not react" if args.play else ""))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
