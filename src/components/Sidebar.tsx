import { useState } from 'react';
import type { TreeNode } from '../types';

interface Props {
  tree: TreeNode[];
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

  if (node.type === 'dir') {
    return (
      <li>
        <button
          className="tree-row tree-dir"
          style={pad}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={`chevron ${open ? 'open' : ''}`}>▸</span>
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
        className={`tree-row tree-file ${active ? 'active' : ''}`}
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
  activePath,
  onSelect,
  collapsed = false,
}: Props) {
  return (
    <nav
      className={`sidebar ${collapsed ? 'collapsed' : ''}`}
      aria-label="Documentation files"
      aria-hidden={collapsed}
    >
      <div className="sidebar-inner">
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
      </div>
    </nav>
  );
}
