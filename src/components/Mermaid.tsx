import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Mermaid as MermaidApi } from "mermaid";
import {
  MAX_SCALE,
  MERMAID_THEME_VARIABLES,
  MIN_SCALE,
  WHEEL_ZOOM_STEP,
} from "../lib/mermaidConfig";

let mermaidPromise: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (mermaidPromise) return mermaidPromise;
  mermaidPromise = import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeVariables: MERMAID_THEME_VARIABLES,
    });
    return mermaid;
  });
  return mermaidPromise;
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

interface PanZoomProps {
  svg: string;
}

function PanZoomViewport({ svg }: PanZoomProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
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
    const svgEl = transformRef.current?.querySelector("svg");
    if (svgEl) {
      const vb = svgEl.viewBox?.baseVal;
      const w = vb && vb.width ? vb.width : svgEl.getBoundingClientRect().width;
      const h = vb && vb.height ? vb.height : svgEl.getBoundingClientRect().height;
      svgEl.style.maxWidth = "none";
      svgEl.style.width = `${w}px`;
      svgEl.style.height = `${h}px`;
    }
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
      const factor = e.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP;
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

  return (
    <>
      <div className="mermaid-controls mermaid-controls-zoom">
        <span className="mermaid-zoom-hint">Scroll to zoom · drag to pan</span>
        <button
          type="button"
          className="mermaid-ctl mermaid-ctl-text"
          onClick={reset}
          aria-label="Reset view"
          title="Reset view"
        >
          Reset
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
          ref={transformRef}
          className="mermaid-transform"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </>
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
  const [panZoom, setPanZoom] = useState(false);

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

  useEffect(() => {
    if (!fullscreen) setPanZoom(false);
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
        <div className="mermaid-controls">
          <button
            type="button"
            className="mermaid-ctl mermaid-ctl-text"
            onClick={() => setFullscreen(true)}
            aria-label="Fullscreen"
            title="Fullscreen"
          >
            ⛶ Fullscreen
          </button>
        </div>
        <div
          className="mermaid-render"
          dangerouslySetInnerHTML={{ __html: svg }}
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
          <div className="mermaid-stage fullscreen">
            <div className="mermaid-controls">
              <button
                type="button"
                className="mermaid-ctl mermaid-ctl-text"
                onClick={() => setPanZoom((v) => !v)}
                aria-pressed={panZoom}
                aria-label={panZoom ? "Disable pan and zoom" : "Enable pan and zoom"}
                title={panZoom ? "Disable pan and zoom" : "Enable pan and zoom"}
              >
                {panZoom ? "Pan / Zoom: on" : "Pan / Zoom: off"}
              </button>
              <button
                type="button"
                className="mermaid-ctl mermaid-ctl-text"
                onClick={() => setFullscreen(false)}
                aria-label="Exit fullscreen"
                title="Exit fullscreen"
              >
                Close
              </button>
            </div>
            {panZoom ? (
              <PanZoomViewport svg={svg} />
            ) : (
              <div
                className="mermaid-render fullscreen"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
