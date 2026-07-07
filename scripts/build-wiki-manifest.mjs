import { readdir, writeFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../public/wiki", import.meta.url));
const KEEP = /\.(md|markdown|ya?ml|json|txt)$/i;
const IGNORE = new Set(["index.json", ".DS_Store", ".git", "node_modules"]);

async function walk(dir) {
  const out = [];
  let entries;

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const e of entries) {
    if (IGNORE.has(e.name)) continue;
    const full = join(dir, e.name);

    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (KEEP.test(e.name))
      out.push(relative(root, full).split("\\").join("/"));
  }

  return out;
}

try {
  await stat(root);
} catch {
  console.log("[wiki-manifest] public/wiki not found, skipping.");
  process.exit(0);
}

const files = (await walk(root)).sort();
await writeFile(join(root, "index.json"), JSON.stringify({ files }, null, 2));
console.log(`[wiki-manifest] wrote index.json with ${files.length} file(s).`);
