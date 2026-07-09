import { describe, it, expect } from "vitest";
import { searchPages } from "./search";
import type { WikiPage } from "../types";

function page(partial: Partial<WikiPage> & { path: string }): WikiPage {
  return {
    title: partial.title ?? partial.path,
    order: null,
    lang: null,
    content: "",
    ...partial,
  };
}

describe("searchPages", () => {
  it("returns nothing for an empty query", () => {
    const pages = [page({ path: "a.md", title: "Alpha" })];
    expect(searchPages(pages, "   ")).toEqual([]);
  });

  it("matches titles case-insensitively and marks the span", () => {
    const pages = [page({ path: "inventory.md", title: "Inventory System" })];
    const [r] = searchPages(pages, "invent");
    expect(r.page.path).toBe("inventory.md");
    expect(r.titleSpans).toEqual([{ start: 0, end: 6 }]);
  });

  it("matches page path when title does not match", () => {
    const pages = [page({ path: "feature/combat.md", title: "Overview" })];
    const results = searchPages(pages, "combat");
    expect(results).toHaveLength(1);
    expect(results[0].page.path).toBe("feature/combat.md");
  });

  it("does not match on body content", () => {
    const pages = [
      page({
        path: "guide.md",
        title: "Guide",
        content: "The quicksave routine flushes to disk.",
      }),
    ];
    expect(searchPages(pages, "quicksave")).toHaveLength(0);
  });

  it("ranks exact title matches above path-only matches", () => {
    const pages = [
      page({ path: "saving/notes.md", title: "Notes" }),
      page({ path: "a.md", title: "Saving" }),
    ];
    const results = searchPages(pages, "saving");
    expect(results[0].page.path).toBe("a.md");
  });

  it("respects the result limit", () => {
    const pages = Array.from({ length: 50 }, (_, i) =>
      page({ path: `p${i}.md`, title: `Item match ${i}` }),
    );
    expect(searchPages(pages, "match", 10)).toHaveLength(10);
  });
});
