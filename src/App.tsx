import { useCallback, useEffect, useMemo, useState } from "react";
import type { FileMap, LoadSource, TreeNode, WikiModel } from "./types";
import { buildWikiModel } from "./lib/wikiModel";
import {
  loadBundled,
  loadFromDrop,
  loadFromInput,
  pickDirectoryHandle,
  readHandle,
  supportsFsAccess,
} from "./lib/loadFolder";
import Sidebar from "./components/Sidebar";
import Breadcrumb from "./components/Breadcrumb";
import MarkdownView from "./components/MarkdownView";
import Loader from "./components/Loader";

const BASE = import.meta.env.BASE_URL;

function SidebarToggleIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="icon-btn-svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="4" y1="6" x2="16" y2="6" />
      <line x1="4" y1="10" x2="16" y2="10" />
      <line x1="4" y1="14" x2="16" y2="14" />
    </svg>
  );
}

function ReloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="btn-icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function resolvePageLink(
  href: string,
  currentPath: string,
  pages: Set<string>,
): string | null {
  if (/^(https?:)?\/\//.test(href) || href.startsWith("#")) return null;
  const [rawPath] = href.split("#");

  if (!rawPath) return null;

  const baseDir = currentPath.includes("/")
    ? currentPath.slice(0, currentPath.lastIndexOf("/"))
    : "";
  const parts = (baseDir ? `${baseDir}/${rawPath}` : rawPath).split("/");
  const stack: string[] = [];

  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }

  let candidate = stack.join("/");

  if (pages.has(candidate)) return candidate;
  if (!/\.md$/i.test(candidate)) {
    if (pages.has(`${candidate}.md`)) return `${candidate}.md`;
  }

  const slug = rawPath.replace(/\.md$/i, "");
  const byName = [...pages].find((p) =>
    p.replace(/\.md$/i, "").toLowerCase().endsWith(slug.toLowerCase()),
  );

  return byName ?? null;
}

export default function App() {
  const [wiki, setWiki] = useState<WikiModel | null>(null);
  const [source, setSource] = useState<LoadSource | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [lang, setLang] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const applyFiles = useCallback(
    (files: FileMap, label: string, src: LoadSource) => {
      if (files.size === 0) {
        setError("No markdown files found in that folder.");
        return;
      }
      const model = buildWikiModel(files, label);
      setWiki(model);
      setSource(src);
      setError(null);
      setLang(model.languages[0] ?? null);
      setCurrent(model.homePath);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const files = await loadBundled(BASE);
      if (!cancelled && files) {
        applyFiles(files, "Bundled docs", { kind: "bundled" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyFiles]);

  const handleInput = async (fl: FileList) => {
    setBusy(true);

    try {
      applyFiles(await loadFromInput(fl), "Selected folder", {
        kind: "picker",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = async (dt: DataTransfer) => {
    setBusy(true);

    try {
      applyFiles(await loadFromDrop(dt), "Dropped folder", { kind: "drop" });
    } finally {
      setBusy(false);
    }
  };

  const handleHandle = async () => {
    setBusy(true);

    try {
      const { handle, files } = await pickDirectoryHandle();
      applyFiles(files, handle.name, { kind: "fsaccess", handle });
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReload = async () => {
    if (!source) return;

    setBusy(true);

    try {
      if (source.kind === "fsaccess") {
        applyFiles(await readHandle(source.handle), source.handle.name, source);
      } else if (source.kind === "bundled") {
        const files = await loadBundled(BASE);
        if (files) applyFiles(files, "Bundled docs", source);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const visiblePages = useMemo(() => {
    if (!wiki) return [];
    if (!lang) return wiki.pages;

    return wiki.pages.filter((p) => p.lang === lang || p.lang === null);
  }, [wiki, lang]);

  const pageSet = useMemo(
    () => new Set(visiblePages.map((p) => p.path)),
    [visiblePages],
  );

  const visibleTree: TreeNode[] = useMemo(() => {
    if (!wiki) return [];
    if (!lang || wiki.languages.length === 0) return wiki.tree;

    const langNode = wiki.tree.find((n) => n.type === "dir" && n.name === lang);

    return langNode?.children ?? wiki.tree;
  }, [wiki, lang]);

  const currentPage = useMemo(
    () => wiki?.pages.find((p) => p.path === current) ?? null,
    [wiki, current],
  );

  useEffect(() => {
    if (!wiki || !lang || !current) return;
    if (pageSet.has(current)) return;

    const tail = current.replace(/^[^/]+\//, "");
    const mapped = `${lang}/${tail}`;

    if (pageSet.has(mapped)) setCurrent(mapped);
    else setCurrent(wiki.homePath);
  }, [lang, wiki, current, pageSet]);

  const breadcrumbSegments = useMemo(() => {
    if (!wiki || !currentPage) return [];
    const label = wiki.meta.title ?? wiki.sourceLabel;
    const parts = currentPage.path.split("/");

    return [label, ...parts];
  }, [wiki, currentPage]);

  const resolveLink = useCallback(
    (href: string) =>
      currentPage ? resolvePageLink(href, currentPage.path, pageSet) : null,
    [currentPage, pageSet],
  );

  if (!wiki) {
    return (
      <div className="app-empty">
        <header className="empty-header">
          <h1>Repo Wiki Viewer</h1>
          <p>Read repo-wiki-standard docs with rendered Mermaid diagrams.</p>
        </header>
        <Loader
          onPickInput={handleInput}
          onPickHandle={handleHandle}
          onDrop={handleDrop}
        />
        {busy && <p className="status">Reading folder…</p>}
        {error && <p className="error-msg">{error}</p>}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="icon-btn"
          onClick={() => setSidebarOpen((s) => !s)}
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          aria-label="Toggle sidebar"
        >
          <SidebarToggleIcon />
        </button>
        <Breadcrumb
          segments={breadcrumbSegments}
          onHome={() => setCurrent(wiki.homePath)}
        />
        <div className="topbar-right">
          {wiki.languages.length > 1 && (
            <select
              className="lang-switch"
              value={lang ?? ""}
              onChange={(e) => setLang(e.target.value)}
              aria-label="Language"
            >
              {wiki.languages.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          )}
          {(source?.kind === "fsaccess" || source?.kind === "bundled") && (
            <button
              className="btn ghost"
              onClick={handleReload}
              disabled={busy}
              title={
                source.kind === "fsaccess"
                  ? "Re-read from disk"
                  : "Reload bundled docs"
              }
            >
              <ReloadIcon />
              Reload
            </button>
          )}
          {supportsFsAccess() ? (
            <button
              className="btn ghost"
              onClick={handleHandle}
              disabled={busy}
            >
              Load folder…
            </button>
          ) : (
            <label className="btn ghost file-relabel">
              Load folder…
              <input
                type="file"
                // @ts-expect-error
                webkitdirectory=""
                directory=""
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) handleInput(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </header>

      <div className="body">
        <Sidebar
          tree={visibleTree}
          pages={visiblePages}
          activePath={current}
          onSelect={setCurrent}
          collapsed={!sidebarOpen}
        />
        <main className="content">
          {error && <p className="error-msg">{error}</p>}
          {currentPage ? (
            <article className="page">
              <MarkdownView
                content={currentPage.content}
                resolveLink={resolveLink}
                onNavigate={setCurrent}
              />
            </article>
          ) : (
            <p className="status">Select a page from the sidebar.</p>
          )}
        </main>
      </div>
    </div>
  );
}
