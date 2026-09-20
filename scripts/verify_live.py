#!/usr/bin/env python3
"""Check the DEPLOYED site at its public sub-path, not the local build.

The site lives at https://east11ventures.com/gametheory/ behind a proxy rewrite, so the one
thing a local smoke test cannot see is a link that escapes the sub-path. That happened on
2026-09-20: Netlify's "pretty URLs" post-processing rewrote ./hex.html into /hex, which passed
every local check and broke every chapter link in production.

Crawls every page reachable from the home page and fails if any page is not a Winning Moves
page, any same-host link points outside the sub-path, or any asset 404s.
"""
from __future__ import annotations

import argparse
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from urllib.parse import urldefrag, urljoin, urlparse

DEFAULT_BASE = "https://east11ventures.com/gametheory/"
LINK_RE = re.compile(r"""<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["']""", re.I)
ASSET_RE = re.compile(r"""<(?:script|link|img)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']""", re.I)


@dataclass
class Report:
    pages: set[str] = field(default_factory=set)
    assets: set[str] = field(default_factory=set)
    problems: list[str] = field(default_factory=list)


def fetch(url: str) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "winning-moves-verify/1"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as err:
        return err.code, ""


def crawl(base: str, expected_pages: int) -> Report:
    report = Report()
    host = urlparse(base).netloc
    queue: list[str] = [base]
    while queue:
        url = queue.pop()
        if url in report.pages:
            continue
        report.pages.add(url)
        status, html = fetch(url)
        if status != 200 or "Winning Moves" not in html:
            report.problems.append(f"not a Winning Moves page: {url} (status {status})")
            continue
        for href in LINK_RE.findall(html):
            target = urldefrag(urljoin(url, href)).url
            if urlparse(target).netloc != host:
                continue
            if not target.startswith(base):
                report.problems.append(f"link escapes the sub-path: {url} -> {href}")
            elif target not in report.pages:
                queue.append(target)
        for src in ASSET_RE.findall(html):
            target = urljoin(url, src)
            if urlparse(target).netloc == host and target not in report.assets:
                report.assets.add(target)
                if not target.startswith(base):
                    report.problems.append(f"asset escapes the sub-path: {url} -> {src}")
                elif fetch(target)[0] != 200:
                    report.problems.append(f"asset missing: {target}")
    if len(report.pages) < expected_pages:
        report.problems.append(f"only {len(report.pages)} pages reachable, expected {expected_pages}")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default=DEFAULT_BASE, help="public URL of the site, with trailing slash")
    parser.add_argument("--pages", type=int, default=25, help="minimum number of reachable pages")
    args = parser.parse_args()
    report = crawl(args.base, args.pages)
    for problem in report.problems:
        print(f"FAIL {problem}")
    print(f"{len(report.pages)} pages, {len(report.assets)} assets checked at {args.base}")
    return 1 if report.problems else 0


if __name__ == "__main__":
    sys.exit(main())
