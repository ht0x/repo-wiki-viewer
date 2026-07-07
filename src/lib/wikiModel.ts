import yaml from "js-yaml";
import type {
  FileMap,
  TreeNode,
  WikiMeta,
  WikiModel,
  WikiPage,
} from "../types";

const MD_EXT = /\.m/i;
const isMarkdown = (p: string) => /\.md$/i.test(p);

function parseOrder(name: string): number | null {
  const m = name.match(/^(\d+)[-_]/);
  return m ? parseInt(m[1], 10) : null;
}

function titleFromFilename(name: string): string {
  return name
    .replace(/\.md$/i, "")
    .replace(/^\d+[-_]/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function deriveTitle(path: string, content: string): string {
  const fm = content.match(/^---\n([\s\S]*?)\n---/);

  if (fm) {
    try {
      const data = yaml.load(fm[1]) as Record<string, unknown> | undefined;

      if (data && typeof data.title === "string" && data.title.trim()) {
        return data.title.trim();
      }
    } catch {}
  }

  const h1 = content.match(/^\s*#\s+(.+?)\s*$/m);
  if (h1) return h1[1].trim();

  return titleFromFilename(path.split("/").pop() ?? path);
}

function detectLang(relPath: string, languages: Set<string>): string | null {
  const first = relPath.split("/")[0];

  if (languages.has(first)) return first;
  return null;
}

function parseMeta(files: FileMap): WikiMeta {
  const meta: WikiMeta = { languages: [] };
  const planKey = [...files.keys()].find((k) =>
    /(^|\/)wiki_plan\.ya?ml$/i.test(k),
  );

  if (planKey) {
    try {
      const plan = yaml.load(files.get(planKey)!) as Record<string, unknown>;
      meta.raw = plan;

      if (plan && typeof plan === "object") {
        if (typeof plan.title === "string") meta.title = plan.title;
        if (Array.isArray(plan.languages)) {
          meta.languages = plan.languages.map(String);
        }

        const pages = (plan.pages ?? plan.order) as unknown;
        if (Array.isArray(pages)) {
          meta.planOrder = pages
            .map((p) =>
              typeof p === "string"
                ? p
                : p && typeof p === "object" && "file" in p
                  ? String((p as Record<string, unknown>).file)
                  : null,
            )
            .filter((x): x is string => !!x);
        }
      }
    } catch {}
  }

  const manifestKey = [...files.keys()].find((k) =>
    /(^|\/)\.wiki_manifest\.json$/i.test(k),
  );

  if (manifestKey) {
    try {
      const man = JSON.parse(files.get(manifestKey)!);

      if (!meta.raw) meta.raw = man;
      if (!meta.title && typeof man.title === "string") meta.title = man.title;
      if (Array.isArray(man.languages) && meta.languages.length === 0) {
        meta.languages = man.languages.map(String);
      }
    } catch {}
  }

  return meta;
}

function buildTree(pages: WikiPage[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", type: "dir", children: [] };

  for (const page of pages) {
    const parts = page.path.split("/");
    let node = root;
    let acc = "";

    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      const isLeaf = i === parts.length - 1;

      if (isLeaf) {
        node.children!.push({
          name: page.title,
          path: acc,
          type: "file",
          pagePath: page.path,
        });
      } else {
        let dir = node.children!.find(
          (c) => c.type === "dir" && c.path === acc,
        );

        if (!dir) {
          dir = { name: part, path: acc, type: "dir", children: [] };
          node.children!.push(dir);
        }

        node = dir;
      }
    });
  }

  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    const withOrder = nodes.map((n) => ({
      n,
      order:
        n.type === "file" ? parseOrder(n.path.split("/").pop() ?? "") : null,
    }));
    withOrder.sort((a, b) => {
      if (a.order !== null && b.order !== null) return a.order - b.order;
      if (a.order !== null) return -1;
      if (b.order !== null) return 1;

      const aTop = /^(home|readme)/i.test(a.n.name);
      const bTop = /^(home|readme)/i.test(b.n.name);

      if (aTop && !bTop) return -1;
      if (bTop && !aTop) return 1;

      return a.n.name.localeCompare(b.n.name);
    });

    return withOrder.map(({ n }) => {
      if (n.children) n.children = sortNodes(n.children);

      return n;
    });
  };

  return sortNodes(root.children!);
}

export function buildWikiModel(files: FileMap, sourceLabel: string): WikiModel {
  void MD_EXT;
  const meta = parseMeta(files);

  const langSet = new Set(meta.languages);
  if (langSet.size === 0) {
    const topDirs = new Map<string, string[]>();

    for (const key of files.keys()) {
      const parts = key.split("/");

      if (parts.length >= 2) {
        const dir = parts[0];

        if (!topDirs.has(dir)) topDirs.set(dir, []);
        topDirs.get(dir)!.push(parts.slice(1).join("/"));
      }
    }

    for (const [dir, inner] of topDirs) {
      const looksLikeLang = /^[a-z]{2}([-_][a-z]{2,4})?$/i.test(dir);
      const hasHome = inner.some((f) => /^(home|readme)\.md$/i.test(f));

      if (looksLikeLang && hasHome) langSet.add(dir);
    }
  }

  const languages = [...langSet];

  const pages: WikiPage[] = [];
  for (const [path, content] of files) {
    if (!isMarkdown(path)) continue;

    const name = path.split("/").pop() ?? path;
    pages.push({
      path,
      title: deriveTitle(path, content),
      order: parseOrder(name),
      lang: detectLang(path, langSet),
      content,
    });
  }

  if (meta.planOrder && meta.planOrder.length) {
    const idx = new Map(
      meta.planOrder.map((p, i) => [p.replace(/^\.?\//, ""), i]),
    );

    pages.sort((a, b) => {
      const ai = idx.get(a.path) ?? Infinity;
      const bi = idx.get(b.path) ?? Infinity;
      if (ai !== bi) return ai - bi;
      return a.path.localeCompare(b.path);
    });
  }

  const tree = buildTree(pages);

  const findHome = (pred: (p: string) => boolean) =>
    pages.find((p) => pred(p.path.split("/").pop() ?? ""))?.path ?? null;
  const homePath =
    findHome((f) => /^home\.md$/i.test(f)) ??
    findHome((f) => /^readme\.md$/i.test(f)) ??
    pages[0]?.path ??
    null;

  return {
    sourceLabel,
    pages,
    tree,
    meta,
    homePath,
    languages,
  };
}
