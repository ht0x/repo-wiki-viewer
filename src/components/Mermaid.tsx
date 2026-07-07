import { useEffect, useId, useRef, useState } from "react";
import type { Mermaid as MermaidApi } from "mermaid";

let mermaidPromise: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (mermaidPromise) return mermaidPromise;
  mermaidPromise = import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeVariables: {
        primaryColor: "#eef0fb",
        primaryBorderColor: "#c7ccf2",
        primaryTextColor: "#1f2333",
        lineColor: "#8b8fa3",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        fontSize: "14px",
      },
    });
    return mermaid;
  });
  return mermaidPromise;
}

interface Props {
  code: string;
}

export default function Mermaid({ code }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/[:]/g, "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const render = async () => {
      try {
        const mermaid = await loadMermaid();
        const { svg } = await mermaid.render(`m-${id}`, code.trim());
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    render();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <div className="mermaid-box mermaid-error">
        <p className="mermaid-error-title">Diagram failed to render</p>
        <pre>{error}</pre>
        <pre className="mermaid-source">{code}</pre>
      </div>
    );
  }

  return (
    <div className="mermaid-box" aria-label="diagram" aria-busy={loading}>
      {loading && <span className="mermaid-loading">Rendering diagram…</span>}
      <div ref={ref} hidden={loading} />
    </div>
  );
}
