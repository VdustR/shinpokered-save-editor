import { useMemo, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Button, Panel, Segmented } from "../components/ui/ui";
import { parseSave } from "../save/savefile";
import { semanticDiff } from "../save/semanticdiff";
import { useSaveStore } from "../state/store";

type BaseMode = "original" | "file";

interface OtherFile {
  name: string;
  bytes: Uint8Array;
}

/** Semantic comparison of the current edits against the original or another save. */
export function ComparePage() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const original = useSaveStore((s) => s.original)!;
  const revision = useSaveStore((s) => s.revision);
  const [mode, setMode] = useState<BaseMode>("original");
  const [other, setOther] = useState<OtherFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const base = mode === "original" ? original : other?.bytes;
  const sections = useMemo(
    () => (base ? semanticDiff(base, bytes) : []),
    // revision tracks byte-level edits that keep the same buffer identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, bytes, revision],
  );

  async function pickFile(file: File) {
    try {
      const raw = new Uint8Array(await file.arrayBuffer());
      const { bytes: parsed } = parseSave(raw);
      setOther({ name: file.name, bytes: parsed });
      setFileError(null);
    } catch (e) {
      // Drop any previous baseline so the page never renders a diff that
      // looks like it came from the file that just failed to load.
      setOther(null);
      setFileError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Compare"
        subtitle="Semantic differences — what changed, in game terms, from the baseline to your current edits."
      />

      <Panel title="Baseline">
        <div className="compare-controls">
          <Segmented
            ariaLabel="Baseline"
            value={mode}
            onChange={(v) => setMode(v as BaseMode)}
            options={[
              { value: "original", label: "Loaded file" },
              { value: "file", label: "Another file" },
            ]}
          />
          {mode === "file" && (
            <>
              <input
                ref={fileRef}
                data-testid="compare-input"
                type="file"
                accept=".sav,.srm,.sa1,.bin"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void pickFile(f);
                  e.target.value = "";
                }}
              />
              <Button size="sm" onClick={() => fileRef.current?.click()}>
                {other ? `Baseline: ${other.name}` : "Choose save file…"}
              </Button>
            </>
          )}
        </div>
        <p className="hint-line">
          Reads left to right: baseline value → current value. Checksums are ignored except in the raw
          byte count.
        </p>
        {fileError && (
          <p className="hint-line hint-line--warn" role="alert">
            Could not read the file: {fileError}
          </p>
        )}
      </Panel>

      {mode === "file" && !other ? (
        <Panel title="Differences">
          <p className="hint-line">Pick a save file to compare against.</p>
        </Panel>
      ) : sections.length === 0 ? (
        <Panel title="Differences">
          <p className="hint-line" data-testid="compare-clean">
            No differences — the saves are semantically identical.
          </p>
        </Panel>
      ) : (
        sections.map((section) => (
          <Panel key={section.title} title={section.title} className="span-2">
            <table className="compare-table" data-testid={`compare-${section.title}`}>
              <tbody>
                {section.entries.map((e, i) => (
                  <tr key={`${e.label}:${i}`}>
                    <th scope="row">{e.label}</th>
                    <td className="compare-table__from">{e.from}</td>
                    <td aria-hidden className="compare-table__arrow">
                      →
                    </td>
                    <td className="compare-table__to">{e.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ))
      )}
    </div>
  );
}
