import { useMemo, useState } from "react";
import type { TreeNode, WikiPage } from "../types";
import { searchPages } from "../lib/search";
import type { SearchMatchSpan } from "../lib/search";

interface Props {
  tree: TreeNode[];
  pages: WikiPage[];
  activePath: string | null;
  onSelect: (pagePath: string) => void;
  collapsed?: boolean;
}

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" className="tree-icon" aria-hidden>
      <path
        fill="currentColor"
        d="M9 1H3.5A1.5 1.5 0 0 0 2 2.5v11A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5V6L9 1Zm0 1.4L12.6 6H9V2.4Z"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" className="search-icon" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        d="M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm3.6-1.4L14 14"
      />
    </svg>
  );
}

function Highlight({ text, spans }: { text: string; spans: SearchMatchSpan[] }) {
  if (spans.length === 0) return <>{text}</>;

  const parts: Array<{ text: string; mark: boolean }> = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      parts.push({ text: text.slice(cursor, span.start), mark: false });
    }
    parts.push({ text: text.slice(span.start, span.end), mark: true });
    cursor = span.end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), mark: false });
  }

  return (
    <>
      {parts.map((part, i) =>
        part.mark ? (
          <mark key={i} className="search-mark">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function Node({
  node,
  depth,
  activePath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  activePath: string | null;
  onSelect: (p: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const pad = { paddingLeft: 8 + depth * 14 };

  if (node.type === "dir") {
    return (
      <li>
        <button
          className="tree-row tree-dir"
          style={pad}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={`chevron ${open ? "open" : ""}`}>▸</span>
          <span className="tree-label">{node.name}</span>
        </button>
        {open && node.children && (
          <ul className="tree-list">
            {node.children.map((child) => (
              <Node
                key={child.path}
                node={child}
                depth={depth + 1}
                activePath={activePath}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const active = node.pagePath === activePath;
  return (
    <li>
      <button
        className={`tree-row tree-file ${active ? "active" : ""}`}
        style={pad}
        onClick={() => node.pagePath && onSelect(node.pagePath)}
      >
        <span className="chevron-spacer" />
        <FileIcon />
        <span className="tree-label">{node.name}</span>
      </button>
    </li>
  );
}

export default function Sidebar({
  tree,
  pages,
  activePath,
  onSelect,
  collapsed = false,
}: Props) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  const results = useMemo(
    () => (trimmed ? searchPages(pages, trimmed) : []),
    [pages, trimmed],
  );

  return (
    <nav
      className={`sidebar ${collapsed ? "collapsed" : ""}`}
      aria-label="Documentation files"
      aria-hidden={collapsed}
    >
      <div className="sidebar-inner">
        <div className="search-box">
          <SearchIcon />
          <input
            className="search-input"
            type="search"
            value={query}
            placeholder="Search pages…"
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search documentation"
          />
          {query && (
            <button
              className="search-clear"
              onClick={() => setQuery("")}
              title="Clear search"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {trimmed ? (
          results.length === 0 ? (
            <p className="search-empty">No matches for “{trimmed}”.</p>
          ) : (
            <ul className="search-results">
              {results.map((r) => {
                const dir = r.page.path.includes("/")
                  ? r.page.path.slice(0, r.page.path.lastIndexOf("/"))
                  : null;
                const active = r.page.path === activePath;
                return (
                  <li key={r.page.path}>
                    <button
                      className={`search-result ${active ? "active" : ""}`}
                      onClick={() => onSelect(r.page.path)}
                    >
                      <span className="search-result-title">
                        <Highlight text={r.page.title} spans={r.titleSpans} />
                      </span>
                      {dir && <span className="search-result-path">{dir}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          <ul className="tree-list tree-root">
            {tree.map((node) => (
              <Node
                key={node.path}
                node={node}
                depth={0}
                activePath={activePath}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
