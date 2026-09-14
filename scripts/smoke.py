#!/usr/bin/env python3
"""Smoke-test built pages with Playwright.

For each page: load it, collect JavaScript errors and console errors, then
click every visible button once (in document order), move every range slider,
and toggle every checkbox, re-collecting errors after each interaction. Any
error fails the page. Also checks that the page body never scrolls
horizontally at phone width (a layout bug the design rules forbid).

Usage: python3 scripts/smoke.py [--out DIR] [--only slug,slug] [--phone]
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

from playwright.sync_api import Browser, ConsoleMessage, Page, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
IGNORE_CONSOLE = ("fonts.googleapis.com", "fonts.gstatic.com", "net::ERR_", "favicon")


@dataclass
class PageReport:
    name: str
    errors: list[str] = field(default_factory=list)
    clicks: int = 0
    overflow_phone: bool = False

    @property
    def ok(self) -> bool:
        return not self.errors and not self.overflow_phone


def run_page(browser: Browser, path: Path, phone: bool) -> PageReport:
    rep = PageReport(name=path.name)
    ctx = browser.new_context(viewport={"width": 400, "height": 800} if phone else {"width": 1200, "height": 900})
    page: Page = ctx.new_page()

    def on_console(msg: ConsoleMessage) -> None:
        if msg.type in ("error",) and not any(s in msg.text for s in IGNORE_CONSOLE):
            rep.errors.append(f"console: {msg.text[:200]}")

    page.on("console", on_console)
    page.on("pageerror", lambda err: rep.errors.append(f"pageerror: {str(err)[:300]}"))
    page.goto(path.as_uri(), wait_until="load")
    page.wait_for_timeout(300)

    # interact: buttons, sliders, checkboxes, selects
    buttons = page.locator("button:visible")
    n = buttons.count()
    for i in range(min(n, 120)):
        b = buttons.nth(i)
        try:
            if b.is_visible() and b.is_enabled():
                b.click(timeout=1500, force=True)
                rep.clicks += 1
                page.wait_for_timeout(60)
        except Exception as exc:  # noqa: BLE001 - a click that cannot land is not a page error
            if "intercepts pointer events" not in str(exc) and "not visible" not in str(exc):
                rep.errors.append(f"click {i}: {str(exc)[:120]}")
    for sl in page.locator("input[type=range]:visible").all()[:40]:
        try:
            for v in (sl.get_attribute("min") or "0", sl.get_attribute("max") or "100"):
                sl.evaluate("(el, v) => { el.value = v; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); }", v)
                page.wait_for_timeout(30)
        except Exception as exc:  # noqa: BLE001
            rep.errors.append(f"slider: {str(exc)[:120]}")
    for cb in page.locator("input[type=checkbox]:visible").all()[:30]:
        try:
            cb.click(timeout=1000, force=True)
            page.wait_for_timeout(30)
        except Exception as exc:  # noqa: BLE001
            rep.errors.append(f"checkbox: {str(exc)[:120]}")
    page.wait_for_timeout(1200)  # let any Robo turns finish

    if phone:
        rep.overflow_phone = bool(page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"))
    ctx.close()
    return rep


def main(argv: list[str]) -> int:
    out = ROOT / "docs"
    only: list[str] = []
    phone = "--phone" in argv
    if "--out" in argv:
        out = Path(argv[argv.index("--out") + 1]).resolve()
    if "--only" in argv:
        only = argv[argv.index("--only") + 1].split(",")
    pages = sorted(p for p in out.glob("*.html") if not only or p.stem in only)
    failures = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for path in pages:
            rep = run_page(browser, path, phone)
            status = "ok " if rep.ok else "FAIL"
            print(f"{status} {rep.name:28s} clicks={rep.clicks:3d}" + (" PHONE-OVERFLOW" if rep.overflow_phone else ""))
            for e in rep.errors[:6]:
                print(f"       {e}")
            if not rep.ok:
                failures += 1
        browser.close()
    print(f"{len(pages) - failures}/{len(pages)} pages clean")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
