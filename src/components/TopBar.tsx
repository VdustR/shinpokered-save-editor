import { useMemo } from "react";
import { PROFILE_LABEL } from "../save/gamedata";
import { summarize, useSaveStore } from "../state/store";
import { Badge, Button } from "./ui/ui";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar({ onExport }: { onExport: () => void }) {
  const fileName = useSaveStore((s) => s.fileName);
  const bytes = useSaveStore((s) => s.bytes);
  const original = useSaveStore((s) => s.original);
  const revert = useSaveStore((s) => s.revert);
  const closeFile = useSaveStore((s) => s.closeFile);

  const summary = useMemo(
    () => (bytes && original ? summarize(bytes, original) : null),
    [bytes, original],
  );

  const dirty = summary ? summary.dirtyBytes : 0;
  const mismatchCount = summary ? summary.mismatches.length : 0;

  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="brand" aria-label="Shin Pokémon Red Save Editor">
          <span className="brand__mark" aria-hidden>
            ●
          </span>
          <span className="brand__name">Shin Red</span>
          <span className="brand__sub">Save Editor</span>
        </div>
        {fileName && (
          <div className="topbar__file">
            <span className="topbar__filename mono" title={fileName}>
              {fileName}
            </span>
            <Badge tone="neutral">{PROFILE_LABEL}</Badge>
          </div>
        )}
      </div>

      {fileName && (
        <div className="topbar__right">
          <ChecksumStatus mismatchCount={mismatchCount} />
          <span className={`dirty ${dirty ? "dirty--on" : ""}`} title="Changed bytes since load">
            <span className="dirty__dot" />
            {dirty ? `${dirty} byte${dirty === 1 ? "" : "s"} changed` : "No changes"}
          </span>
          <div className="topbar__divider" />
          <Button size="sm" variant="ghost" onClick={revert} disabled={!dirty}>
            Revert
          </Button>
          <Button size="sm" variant="ghost" onClick={closeFile}>
            Close
          </Button>
          <Button size="sm" variant="primary" onClick={onExport}>
            Export…
          </Button>
          <ThemeToggle />
        </div>
      )}
      {!fileName && (
        <div className="topbar__right">
          <ThemeToggle />
        </div>
      )}
    </header>
  );
}

function ChecksumStatus({ mismatchCount }: { mismatchCount: number }) {
  if (mismatchCount === 0) {
    return (
      <span className="checksum checksum--ok" title="All checksums valid">
        <Icon.Check />
        Checksums OK
      </span>
    );
  }
  return (
    <span className="checksum checksum--warn" title={`${mismatchCount} checksum group(s) will be repaired on export`}>
      <Icon.Warn />
      {mismatchCount} to repair
    </span>
  );
}

const Icon = {
  Check: () => (
    <svg viewBox="0 0 14 14" width="13" height="13" fill="none" aria-hidden>
      <path d="M2.5 7.5 6 11l5.5-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Warn: () => (
    <svg viewBox="0 0 14 14" width="13" height="13" fill="none" aria-hidden>
      <path d="M7 1.5 13 12.5H1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7 5.5v3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="10.6" r="0.8" fill="currentColor" />
    </svg>
  ),
};
