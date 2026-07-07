import { useRef, useState } from "react";
import { supportsFsAccess } from "../lib/loadFolder";

interface Props {
  onPickInput: (files: FileList) => void;
  onPickHandle: () => void;
  onDrop: (dt: DataTransfer) => void;
  compact?: boolean;
}

export default function Loader({
  onPickInput,
  onPickHandle,
  onDrop,
  compact,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const fsAccess = supportsFsAccess();

  const handleLoad = () => {
    if (fsAccess) onPickHandle();
    else inputRef.current?.click();
  };

  return (
    <div
      className={`dropzone ${dragging ? "dragging" : ""} ${compact ? "compact" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onDrop(e.dataTransfer);
      }}
    >
      {!compact && (
        <>
          <div className="dropzone-title">Load a documentation folder</div>
          <p className="dropzone-sub">
            Load a <code>repo-wiki-standard</code> output folder (or any folder
            of <code>.md</code> files). Nothing is sent to a server — files are
            read entirely in your browser.
          </p>
        </>
      )}
      <div className="dropzone-actions">
        <button className="btn primary" onClick={handleLoad}>
          Load folder…
        </button>
        <span className="drop-hint">or drag &amp; drop a folder here</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        // @ts-expect-error
        webkitdirectory=""
        directory=""
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) onPickInput(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
