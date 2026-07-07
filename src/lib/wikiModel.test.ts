import { describe, it, expect } from "vitest";
import { buildWikiModel } from "./wikiModel";
import type { FileMap } from "../types";

function fm(entries: Record<string, string>): FileMap {
  return new Map(Object.entries(entries));
}

describe("buildWikiModel — title derivation", () => {
  it("prefers frontmatter title", () => {
    const model = buildWikiModel(
      fm({ "guide.md": "---\ntitle: My Custom Title\n---\n# Heading\nbody" }),
      "src",
    );
    expect(model.pages[0].title).toBe("My Custom Title");
  });

  it("falls back to first H1 when no frontmatter title", () => {
    const model = buildWikiModel(
      fm({ "guide.md": "# Actual Heading\n\nsome body" }),
      "src",
    );
    expect(model.pages[0].title).toBe("Actual Heading");
  });

  it("falls back to a cleaned-up filename when no title or H1", () => {
    const model = buildWikiModel(
      fm({ "01-getting-started.md": "no headings here" }),
      "src",
    );
    expect(model.pages[0].title).toBe("Getting Started");
  });

  it("ignores malformed frontmatter and uses the H1", () => {
    const model = buildWikiModel(
      fm({ "x.md": "---\n: : broken yaml : :\n---\n# Fallback H1" }),
      "src",
    );
    expect(model.pages[0].title).toBe("Fallback H1");
  });
});

describe("buildWikiModel — order parsing", () => {
  it("parses a numeric prefix into order", () => {
    const model = buildWikiModel(fm({ "03-intro.md": "x" }), "src");
    expect(model.pages[0].order).toBe(3);
  });

  it("returns null order for files without a numeric prefix", () => {
    const model = buildWikiModel(fm({ "intro.md": "x" }), "src");
    expect(model.pages[0].order).toBeNull();
  });
});

describe("buildWikiModel — markdown filtering", () => {
  it("includes only markdown files as pages", () => {
    const model = buildWikiModel(
      fm({
        "home.md": "# Home",
        "wiki_plan.yaml": "title: Wiki",
        "notes.txt": "not markdown",
        "data.json": "{}",
      }),
      "src",
    );
    const paths = model.pages.map((p) => p.path).sort();
    expect(paths).toEqual(["home.md"]);
  });
});

describe("buildWikiModel — language detection", () => {
  it("detects languages from wiki_plan.yaml and tags pages", () => {
    const model = buildWikiModel(
      fm({
        "wiki_plan.yaml": "languages:\n  - en\n  - vi\n",
        "en/home.md": "# Home",
        "vi/home.md": "# Trang chủ",
      }),
      "src",
    );
    expect(model.languages.sort()).toEqual(["en", "vi"]);
    const en = model.pages.find((p) => p.path === "en/home.md");
    const vi = model.pages.find((p) => p.path === "vi/home.md");
    expect(en?.lang).toBe("en");
    expect(vi?.lang).toBe("vi");
  });

  it("infers language dirs when plan is absent", () => {
    const model = buildWikiModel(
      fm({
        "en/home.md": "# Home",
        "fr/home.md": "# Accueil",
      }),
      "src",
    );
    expect(model.languages.sort()).toEqual(["en", "fr"]);
  });

  it("does not treat a non-language top dir as a language", () => {
    const model = buildWikiModel(
      fm({ "architecture/home.md": "# Home" }),
      "src",
    );
    expect(model.languages).toEqual([]);
  });
});

describe("buildWikiModel — tree building", () => {
  it("nests files under directory nodes", () => {
    const model = buildWikiModel(
      fm({
        "home.md": "# Home",
        "modules/inventory.md": "# Inventory",
        "modules/combat.md": "# Combat",
      }),
      "src",
    );
    const dir = model.tree.find((n) => n.type === "dir" && n.path === "modules");
    expect(dir).toBeDefined();
    expect(dir?.children?.map((c) => c.path).sort()).toEqual([
      "modules/combat.md",
      "modules/inventory.md",
    ]);
  });

  it("sorts numeric-prefixed files by their order", () => {
    const model = buildWikiModel(
      fm({
        "02-second.md": "x",
        "01-first.md": "x",
        "03-third.md": "x",
      }),
      "src",
    );
    expect(model.tree.map((n) => n.path)).toEqual([
      "01-first.md",
      "02-second.md",
      "03-third.md",
    ]);
  });
});

describe("buildWikiModel — plan-order sorting", () => {
  it("orders pages according to wiki_plan pages list", () => {
    const model = buildWikiModel(
      fm({
        "wiki_plan.yaml": "pages:\n  - b.md\n  - a.md\n",
        "a.md": "# A",
        "b.md": "# B",
      }),
      "src",
    );
    // Non-plan files (wiki_plan.yaml is not markdown) excluded; order is b then a.
    expect(model.pages.map((p) => p.path)).toEqual(["b.md", "a.md"]);
  });
});

describe("buildWikiModel — home resolution", () => {
  it("prefers home.md", () => {
    const model = buildWikiModel(
      fm({ "readme.md": "# Readme", "home.md": "# Home" }),
      "src",
    );
    expect(model.homePath).toBe("home.md");
  });

  it("falls back to readme.md when no home.md", () => {
    const model = buildWikiModel(
      fm({ "readme.md": "# Readme", "other.md": "# Other" }),
      "src",
    );
    expect(model.homePath).toBe("readme.md");
  });

  it("falls back to the first page when neither exists", () => {
    const model = buildWikiModel(fm({ "only.md": "# Only" }), "src");
    expect(model.homePath).toBe("only.md");
  });

  it("returns null home when there are no pages", () => {
    const model = buildWikiModel(fm({ "data.json": "{}" }), "src");
    expect(model.homePath).toBeNull();
  });
});

describe("buildWikiModel — meta", () => {
  it("reads title from wiki_plan.yaml", () => {
    const model = buildWikiModel(
      fm({ "wiki_plan.yaml": "title: Evergreen Wiki\n", "home.md": "# Home" }),
      "src",
    );
    expect(model.meta.title).toBe("Evergreen Wiki");
  });

  it("passes through the source label", () => {
    const model = buildWikiModel(fm({ "home.md": "# Home" }), "MyFolder");
    expect(model.sourceLabel).toBe("MyFolder");
  });
});
