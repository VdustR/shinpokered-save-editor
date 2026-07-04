import { useEffect, useMemo, useRef, useState } from "react";
import { diffRanges } from "../save/diff";
import { exportSaveWithReport } from "../save/savefile";
import { summarize, useSaveStore } from "../state/store";
import { Badge, Button } from "./ui/ui";
import "./export-dialog.css";

function suggestedName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : ".sav";
  return `${base}-edited${ext}`;
}

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const bytes = useSaveStore((s) => s.bytes);
  const original = useSaveStore((s) => s.original);
  const fileName = useSaveStore((s) => s.fileName);
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      setName(suggestedName(fileName ?? "save.sav"));
      dlg.showModal();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open, fileName]);

  const summary = useMemo(
    () => (bytes && original ? summarize(bytes, original) : null),
    [bytes, original],
  );
  const changedRanges = useMemo(
    () => (bytes && original ? diffRanges(bytes, original).length : 0),
    [bytes, original],
  );

  function download() {
    if (!bytes || !original) return;
    const { bytes: out } = exportSaveWithReport(bytes, original);
    const blob = new Blob([out.buffer as ArrayBuffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name.trim() || "save.sav";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onClose();
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onCancel={onClose}>
      {summary && (
        <div className="dialog__inner">
          <header className="dialog__head">
            <h2 className="dialog__title">Export save</h2>
            <button className="dialog__x" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </header>

          <p className="dialog__lead">
            A new file is downloaded; your original is never modified. Checksums are repaired only for the
            groups you changed.
          </p>

          <dl className="dialog__summary">
            <div>
              <dt>Changed bytes</dt>
              <dd className="mono">{summary.dirtyBytes}</dd>
            </div>
            <div>
              <dt>Changed ranges</dt>
              <dd className="mono">{changedRanges}</dd>
            </div>
            <div>
              <dt>Checksums repaired</dt>
              <dd>
                {summary.repairPreview.length === 0 ? (
                  <Badge tone="neutral">None</Badge>
                ) : (
                  <span className="dialog__chips">
                    {summary.repairPreview.map((g) => (
                      <Badge key={g.id} tone="primary">
                        {g.id}
                      </Badge>
                    ))}
                  </span>
                )}
              </dd>
            </div>
          </dl>

          <label className="dialog__field">
            <span>File name</span>
            <input className="control mono" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <footer className="dialog__foot">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={download} data-testid="download-save">
              Download save
            </Button>
          </footer>
        </div>
      )}
    </dialog>
  );
}
