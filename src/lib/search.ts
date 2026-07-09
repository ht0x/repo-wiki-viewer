import type { WikiPage } from "../types";

export interface SearchMatchSpan {
  start: number;
  end: number;
}

export interface SearchResult {
  page: WikiPage;
  score: number;
  titleSpans: SearchMatchSpan[];
}

function findSpans(haystack: string, needle: string): SearchMatchSpan[] {
  const spans: SearchMatchSpan[] = [];
  if (!needle) return spans;

  const lower = haystack.toLowerCase();
  let from = 0;

  while (from <= lower.length) {
    const idx = lower.indexOf(needle, from);
    if (idx === -1) break;
    spans.push({ start: idx, end: idx + needle.length });
    from = idx + needle.length;
  }

  return spans;
}

export function searchPages(
  pages: WikiPage[],
  query: string,
  limit = 30,
): SearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const results: SearchResult[] = [];

  for (const page of pages) {
    const title = page.title;
    const titleSpans = findSpans(title, needle);
    const pathHit = page.path.toLowerCase().includes(needle);

    if (titleSpans.length === 0 && !pathHit) continue;

    let score = 0;
    if (title.toLowerCase() === needle) score += 100;
    if (titleSpans.length > 0) score += 50;
    if (pathHit) score += 20;

    results.push({ page, score, titleSpans });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.page.title.localeCompare(b.page.title);
  });

  return results.slice(0, limit);
}
