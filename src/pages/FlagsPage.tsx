import { useMemo, useState } from "react";
import { EVENT_FLAGS, eventFlagByteOffset, getEventFlag, setEventFlag } from "../save/events";
import { fuzzyScore } from "../save/search";
import { TOWNS, TOWNS_VISITED_OFFSET, getTownVisited, setTownVisited } from "../save/towns";
import { useNav } from "../state/nav";
import { useSaveStore } from "../state/store";
import { Button, OffsetChip, Panel, Toggle } from "../components/ui/ui";
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
    if (query.trim() === "") return EVENT_FLAGS;
    const scored: { flag: (typeof EVENT_FLAGS)[number]; score: number }[] = [];
    for (const flag of EVENT_FLAGS) {
      const score = fuzzyScore(query, flag.label);
      if (score === null) continue;
      scored.push({ flag, score });
    }
    scored.sort((a, b) => a.score - b.score || a.flag.index - b.flag.index);
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

      <Panel
        className="towns-panel"
        title={
          <span className="panel-title-row">
            Fly destinations <OffsetChip offset={TOWNS_VISITED_OFFSET} onJump={jump} />
          </span>
        }
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => mutate((b) => TOWNS.forEach((t) => setTownVisited(b, t.mapId, true)))}
          >
            Visit all
          </Button>
        }
      >
        <p className="hint-line">
          Towns the game marks as visited on entry; a set bit unlocks that Fly destination. Indigo
          Plateau only affects the town map.
        </p>
        <div className="towns-grid">
          {TOWNS.map((town) => (
            <Toggle
              key={town.mapId}
              checked={getTownVisited(bytes, town.mapId)}
              label={town.name}
              onChange={(v) => mutate((b) => setTownVisited(b, town.mapId, v))}
            />
          ))}
        </div>
      </Panel>

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
                label={flag.label}
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
