import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
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

const MIN_SCALE = 0.3;
const MAX_SCALE = 4;

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

interface ViewportProps {
  svg: string;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

function DiagramViewport({
  svg,
  fullscreen,
  onToggleFullscreen,
}: ViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = useCallback(() => setTransform(IDENTITY), []);

  useEffect(() => {
    reset();
  }, [svg, reset]);

  const zoomAt = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      setTransform((prev) => {
        const nextScale = clampScale(prev.scale * factor);
        const ratio = nextScale / prev.scale;
        return {
          scale: nextScale,
          x: px - (px - prev.x) * ratio,
          y: py - (py - prev.y) * ratio,
        };
      });
    },
    [],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomAt(factor, e.clientX, e.clientY);
    },
    [zoomAt],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const el = viewportRef.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: transform.x,
        originY: transform.y,
      };
      setDragging(true);
    },
    [transform.x, transform.y],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setTransform((prev) => ({
      ...prev,
      x: drag.originX + (e.clientX - drag.startX),
      y: drag.originY + (e.clientY - drag.startY),
    }));
  }, []);

  const endDrag = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  }, []);

  const zoomButton = useCallback(
    (factor: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
    },
    [zoomAt],
  );

  return (
    <div className={fullscreen ? "mermaid-stage fullscreen" : "mermaid-stage"}>
      <div className="mermaid-controls">
        <button
          type="button"
          className="mermaid-ctl"
          onClick={() => zoomButton(1 / 1.2)}
          aria-label="Zoom out"
          title="Zoom out"
        >
          &minus;
        </button>
        <span className="mermaid-zoom-level">
          {Math.round(transform.scale * 100)}%
        </span>
        <button
          type="button"
          className="mermaid-ctl"
          onClick={() => zoomButton(1.2)}
          aria-label="Zoom in"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="mermaid-ctl mermaid-ctl-text"
          onClick={reset}
          aria-label="Reset zoom"
          title="Reset zoom"
        >
          Reset
        </button>
        <button
          type="button"
          className="mermaid-ctl mermaid-ctl-text"
          onClick={onToggleFullscreen}
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {fullscreen ? "Close" : "⛶ Fullscreen"}
        </button>
      </div>
      <div
        ref={viewportRef}
        className={dragging ? "mermaid-viewport grabbing" : "mermaid-viewport"}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="mermaid-transform"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}

interface Props {
  code: string;
}

export default function Mermaid({ code }: Props) {
  const id = useId().replace(/[:]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const render = async () => {
      try {
        const mermaid = await loadMermaid();
        const { svg: rendered } = await mermaid.render(`m-${id}`, code.trim());
        if (!cancelled) {
          setSvg(rendered);
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

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  if (error) {
    return (
      <div className="mermaid-box mermaid-error">
        <p className="mermaid-error-title">Diagram failed to render</p>
        <pre>{error}</pre>
        <pre className="mermaid-source">{code}</pre>
      </div>
    );
  }

  if (loading || !svg) {
    return (
      <div className="mermaid-box" aria-label="diagram" aria-busy>
        <span className="mermaid-loading">Rendering diagram…</span>
      </div>
    );
  }

  return (
    <>
      <div className="mermaid-box">
        <DiagramViewport
          svg={svg}
          fullscreen={false}
          onToggleFullscreen={() => setFullscreen(true)}
        />
      </div>
      {fullscreen && (
        <div
          className="mermaid-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Diagram fullscreen"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFullscreen(false);
          }}
        >
          <DiagramViewport
            svg={svg}
            fullscreen
            onToggleFullscreen={() => setFullscreen(false)}
          />
        </div>
      )}
    </>
  );
}
