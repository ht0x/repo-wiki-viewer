import type { FileMap } from "../types";

const TEXT_RE = /\.(md|markdown|ya?ml|json|txt)$/i;
const IGNORE = new Set([".git", "node_modules", ".DS_Store"]);

export function supportsFsAccess(): boolean {
  return (
    typeof (window as unknown as { showDirectoryPicker?: unknown })
      .showDirectoryPicker === "function"
  );
}

function stripRoot(paths: string[]): (p: string) => string {
  const firsts = new Set(paths.map((p) => p.split("/")[0]));

  if (firsts.size === 1 && paths.every((p) => p.includes("/"))) {
    return (p) => p.split("/").slice(1).join("/");
  }

  return (p) => p;
}

async function filesToMap(
  entries: { path: string; file: File }[],
): Promise<FileMap> {
  const kept = entries.filter(
    ({ path }) =>
      TEXT_RE.test(path) && !path.split("/").some((seg) => IGNORE.has(seg)),
  );
  const rel = stripRoot(kept.map((e) => e.path));
  const map: FileMap = new Map();

  await Promise.all(
    kept.map(async ({ path, file }) => {
      const text = await file.text();
      map.set(rel(path), text);
    }),
  );

  return map;
}

export async function loadFromInput(fileList: FileList): Promise<FileMap> {
  const entries = Array.from(fileList).map((file) => ({
    path:
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name,
    file,
  }));

  return filesToMap(entries);
}

export async function loadFromDrop(dt: DataTransfer): Promise<FileMap> {
  const roots: FileSystemEntry[] = [];

  for (const item of Array.from(dt.items)) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) roots.push(entry);
  }

  const out: { path: string; file: File }[] = [];

  const readEntry = (entry: FileSystemEntry, prefix: string): Promise<void> =>
    new Promise((resolve) => {
      if (entry.isFile) {
        (entry as FileSystemFileEntry).file(
          (file) => {
            out.push({ path: `${prefix}${entry.name}`, file });
            resolve();
          },
          () => resolve(),
        );
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const all: FileSystemEntry[] = [];
        const readBatch = () =>
          reader.readEntries(
            (batch) => {
              if (!batch.length) {
                Promise.all(
                  all.map((e) => readEntry(e, `${prefix}${entry.name}/`)),
                ).then(() => resolve());
                return;
              }
              all.push(...batch);
              readBatch();
            },
            () => resolve(),
          );

        readBatch();
      } else {
        resolve();
      }
    });

  await Promise.all(roots.map((e) => readEntry(e, "")));

  return filesToMap(out);
}

async function walkHandle(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: { path: string; file: File }[],
): Promise<void> {
  // @ts-expect-error
  for await (const [name, handle] of dir.entries()) {
    if (IGNORE.has(name)) continue;

    if (handle.kind === "file") {
      const file = await (handle as FileSystemFileHandle).getFile();
      out.push({ path: `${prefix}${name}`, file });
    } else {
      await walkHandle(
        handle as FileSystemDirectoryHandle,
        `${prefix}${name}/`,
        out,
      );
    }
  }
}

export async function pickDirectoryHandle(): Promise<{
  handle: FileSystemDirectoryHandle;
  files: FileMap;
}> {
  const handle = await (
    window as unknown as {
      showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker();

  const files = await readHandle(handle);

  return { handle, files };
}

export async function readHandle(
  handle: FileSystemDirectoryHandle,
): Promise<FileMap> {
  const out: { path: string; file: File }[] = [];

  await walkHandle(handle, "", out);

  return filesToMap(out);
}

export async function loadBundled(base: string): Promise<FileMap | null> {
  const root = `${base}wiki/`;

  try {
    const res = await fetch(`${root}index.json`, { cache: "no-cache" });
    if (!res.ok) return null;

    const manifest = (await res.json()) as { files: string[] };
    if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
      return null;
    }

    const map: FileMap = new Map();
    await Promise.all(
      manifest.files.map(async (rel) => {
        const r = await fetch(`${root}${rel}`, { cache: "no-cache" });
        if (r.ok) map.set(rel, await r.text());
      }),
    );

    return map.size ? map : null;
  } catch {
    return null;
  }
}
