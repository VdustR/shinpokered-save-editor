import { useMemo, useState } from "react";
import {
  EVENT_FLAGS,
  UNNAMED_EVENT_FLAGS,
  eventFlagByteOffset,
  getEventFlag,
  setEventFlag,
  type EventFlag,
} from "../save/events";
import {
  HIDDEN_COINS,
  HIDDEN_COINS_OFFSET,
  HIDDEN_ITEMS,
  HIDDEN_ITEMS_OFFSET,
  getHiddenFlag,
  hiddenSpotLabel,
  setHiddenFlag,
  type HiddenSpot,
} from "../save/hidden";
import { MISSABLE_BALLS, MISSABLES_OFFSET, ballLabel, getMissable, setMissable } from "../save/missables";
import { fuzzyScore } from "../save/search";
import { TOWNS, TOWNS_VISITED_OFFSET, getTownVisited, setTownVisited } from "../save/towns";
import { useNav } from "../state/nav";
import { useSaveStore } from "../state/store";
import { Button, OffsetChip, Panel, Toggle } from "../components/ui/ui";
import { PageHeader } from "../components/PageHeader";

const ALL_FLAGS: readonly EventFlag[] = [...EVENT_FLAGS, ...UNNAMED_EVENT_FLAGS].sort(
  (a, b) => a.index - b.index,
);

/**
 * Story/event flag table over wEventFlags with fuzzy search. Flags the game
 * manages as a set (story progression) can be inconsistent if toggled
 * individually, so the page leads with a caution rather than hiding the
 * capability. Unnamed bits are opt-in: they have no known meaning and exist
 * for parity with the hex view.
 */
export function FlagsPage() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const mutate = useSaveStore((s) => s.mutate);
  const jump = useNav((s) => s.jumpToHex);
  const [query, setQuery] = useState("");
  const [onlySet, setOnlySet] = useState(false);
  const [showUnnamed, setShowUnnamed] = useState(false);

  const pool = showUnnamed ? ALL_FLAGS : EVENT_FLAGS;

  const matches = useMemo(() => {
    if (query.trim() === "") return pool;
    const scored: { flag: EventFlag; score: number }[] = [];
    for (const flag of pool) {
      const score = fuzzyScore(query, flag.label);
      if (score === null) continue;
      scored.push({ flag, score });
    }
    scored.sort((a, b) => a.score - b.score || a.flag.index - b.flag.index);
    return scored.map((s) => s.flag);
  }, [query, pool]);

  const shown = useMemo(
    () => (onlySet ? matches.filter((f) => getEventFlag(bytes, f.index)) : matches),
    [matches, onlySet, bytes],
  );

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

      <HiddenSpotsPanel
        title="Hidden items"
        spots={HIDDEN_ITEMS}
        baseOffset={HIDDEN_ITEMS_OFFSET}
        hint="Checked spots have been picked up; unchecking makes the hidden item findable again."
        fallbackLabel="?"
      />
      <HiddenSpotsPanel
        title="Hidden coins"
        spots={HIDDEN_COINS}
        baseOffset={HIDDEN_COINS_OFFSET}
        hint="Game Corner floor coins; unchecking makes a spot findable again."
        fallbackLabel="coins"
      />
      <MissableBallsPanel />

      <div className="flags-controls">
        <input
          className="control"
          placeholder="Search flags… (e.g. town map, rival, ss anne)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search flags"
        />
        <Toggle checked={onlySet} label="Only set flags" onChange={setOnlySet} />
        <Toggle checked={showUnnamed} label="Show unnamed bits" onChange={setShowUnnamed} />
        <span className="mono muted">
          {shown.length} / {pool.length}
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
              <span
                className="flag-row__meta mono"
                title={flag.usedIn ? `Referenced by: ${flag.usedIn.join(", ")}` : undefined}
              >
                {flag.usedIn ? `${flag.usedIn.length} refs · ` : ""}
                {flag.name.replace(/^EVENT_/, "")} · bit {flag.index & 7}
              </span>
              <OffsetChip offset={eventFlagByteOffset(flag.index)} onJump={jump} />
            </div>
          );
        })}
        {shown.length === 0 && <p className="hint-line">No flags match.</p>}
      </div>
    </div>
  );
}

/**
 * Overworld item balls (missable objects). Checked = picked up (hidden);
 * unchecking respawns the ball. Bit indices are sparse HS_* values, so this
 * panel addresses each ball's own bit rather than a sequential range.
 */
function MissableBallsPanel() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const mutate = useSaveStore((s) => s.mutate);
  const jump = useNav((s) => s.jumpToHex);

  return (
    <Panel
      className="towns-panel"
      title={
        <span className="panel-title-row">
          Item balls <OffsetChip offset={MISSABLES_OFFSET} onJump={jump} />
        </span>
      }
      actions={
        <Button
          size="sm"
          variant="ghost"
          onClick={() => mutate((b) => MISSABLE_BALLS.forEach((ball) => setMissable(b, ball.index, false)))}
        >
          Respawn all
        </Button>
      }
    >
      <p className="hint-line">
        Overworld Poké Ball pickups. Checked balls have been collected; unchecking makes the ball
        reappear on the map. NPC visibility shares this flag table and stays hex-only on purpose.
      </p>
      <div className="towns-grid towns-grid--wide">
        {MISSABLE_BALLS.map((ball) => (
          <Toggle
            key={ball.index}
            checked={getMissable(bytes, ball.index)}
            label={ballLabel(ball)}
            onChange={(v) => mutate((b) => setMissable(b, ball.index, v))}
          />
        ))}
      </div>
    </Panel>
  );
}

/** Toggle grid over one hidden-pickup flag region, with a restore-all action. */
function HiddenSpotsPanel({
  title,
  spots,
  baseOffset,
  hint,
  fallbackLabel,
}: {
  title: string;
  spots: readonly HiddenSpot[];
  baseOffset: number;
  hint: string;
  fallbackLabel: string;
}) {
  const bytes = useSaveStore((s) => s.bytes)!;
  const mutate = useSaveStore((s) => s.mutate);
  const jump = useNav((s) => s.jumpToHex);

  return (
    <Panel
      className="towns-panel"
      title={
        <span className="panel-title-row">
          {title} <OffsetChip offset={baseOffset} onJump={jump} />
        </span>
      }
      actions={
        <Button
          size="sm"
          variant="ghost"
          onClick={() => mutate((b) => spots.forEach((_, i) => setHiddenFlag(b, baseOffset, i, false)))}
        >
          Restore all
        </Button>
      }
    >
      <p className="hint-line">{hint}</p>
      <div className="towns-grid towns-grid--wide">
        {spots.map((spot, i) => (
          <Toggle
            key={i}
            checked={getHiddenFlag(bytes, baseOffset, i)}
            label={hiddenSpotLabel(spot, fallbackLabel)}
            onChange={(v) => mutate((b) => setHiddenFlag(b, baseOffset, i, v))}
          />
        ))}
      </div>
    </Panel>
  );
}
