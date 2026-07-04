import { useMemo, useState } from "react";
import { EVENT_FLAGS, eventFlagByteOffset, eventFlagLabel, getEventFlag, setEventFlag } from "../save/events";
import { fuzzyScore } from "../save/search";
import { useNav } from "../state/nav";
import { useSaveStore } from "../state/store";
import { OffsetChip, Toggle } from "../components/ui/ui";
import { PageHeader } from "../components/PageHeader";

const PAGE_LIMIT = 120;

/**
 * Story/event flag table: the named subset of wEventFlags with fuzzy search.
 * Flags the game manages as a set (story progression) can be inconsistent if
 * toggled individually, so the page leads with a caution rather than hiding
 * the capability.
 */
export function FlagsPage() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const mutate = useSaveStore((s) => s.mutate);
  const jump = useNav((s) => s.jumpToHex);
  const [query, setQuery] = useState("");
  const [onlySet, setOnlySet] = useState(false);

  const matches = useMemo(() => {
    const scored: { flag: (typeof EVENT_FLAGS)[number]; score: number }[] = [];
    for (const flag of EVENT_FLAGS) {
      const score = fuzzyScore(query, flag.name.replace(/^EVENT_/, "").replace(/_/g, " "));
      if (score === null) continue;
      scored.push({ flag, score });
    }
    if (query.trim() !== "") scored.sort((a, b) => a.score - b.score || a.flag.index - b.flag.index);
    return scored.map((s) => s.flag);
  }, [query]);

  const visible = useMemo(
    () => (onlySet ? matches.filter((f) => getEventFlag(bytes, f.index)) : matches),
    [matches, onlySet, bytes],
  );
  const shown = visible.slice(0, PAGE_LIMIT);

  return (
    <div className="page">
      <PageHeader
        title="Story flags"
        subtitle="Named event flags from the game's 320-byte flag table. The game sets these in groups; toggling story milestones out of order can strand NPCs or skip rewards — keep a backup."
      />

      <div className="flags-controls">
        <input
          className="control"
          placeholder="Search flags… (e.g. town map, rival, ss anne)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search flags"
        />
        <Toggle checked={onlySet} label="Only set flags" onChange={setOnlySet} />
        <span className="mono muted">
          {visible.length} / {EVENT_FLAGS.length}
        </span>
      </div>

      <div className="flags-list">
        {shown.map((flag) => {
          const value = getEventFlag(bytes, flag.index);
          return (
            <div className="flag-row" key={flag.index}>
              <Toggle
                checked={value}
                label={eventFlagLabel(flag.name)}
                onChange={(v) => mutate((b) => setEventFlag(b, flag.index, v))}
              />
              <span className="flag-row__meta mono">
                {flag.name.replace(/^EVENT_/, "")} · bit {flag.index & 7}
              </span>
              <OffsetChip offset={eventFlagByteOffset(flag.index)} onJump={jump} />
            </div>
          );
        })}
        {visible.length > PAGE_LIMIT && (
          <p className="hint-line">Showing the first {PAGE_LIMIT} matches — refine the search to narrow down.</p>
        )}
        {visible.length === 0 && <p className="hint-line">No flags match.</p>}
      </div>
    </div>
  );
}
