import { useCallback, useRef, useState } from "react";
import { useSaveStore } from "../state/store";
import { Button } from "./ui/ui";
import "./file-dropzone.css";

const ACCEPT = ".sav,.srm,.sgm,application/octet-stream";

export function FileDropzone() {
  const loadFile = useSaveStore((s) => s.loadFile);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(
    async (file: File) => {
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        loadFile(file.name, buf);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read that file.");
      }
    },
    [loadFile],
  );

  return (
    <div className="dropzone-wrap">
      <div
        className={`dropzone ${dragOver ? "dropzone--over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void accept(file);
        }}
      >
        <div className="dropzone__glyph" aria-hidden>
          <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
            <rect x="7" y="4" width="34" height="40" rx="4" stroke="currentColor" strokeWidth="2" />
            <path d="M15 14h18M15 22h18M15 30h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="dropzone__title">Open a save file</h2>
        <p className="dropzone__hint">
          Drop a Gen 1 <span className="mono">.sav</span> / <span className="mono">.srm</span> file here, or
          choose one. It stays in your browser: nothing is uploaded.
        </p>
        <Button variant="primary" onClick={() => inputRef.current?.click()}>
          Choose save file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="visually-hidden"
          data-testid="file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void accept(file);
            e.target.value = "";
          }}
        />
        {error && (
          <p className="dropzone__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
