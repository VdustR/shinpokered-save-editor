import { useMemo } from "react";
import { GAMEDATA_META } from "../save/gamedata";
import {
  BADGE_NAMES,
  getBadges,
  getBagItems,
  getCoins,
  getCurrentBoxIndex,
  getMoney,
  getParty,
  getPcItems,
  getPlayTime,
  getPlayerId,
  getPlayerName,
} from "../save/savefile";
import { useNav, type PageId } from "../state/nav";
import { summarize, useSaveStore } from "../state/store";
import { Badge, Panel } from "../components/ui/ui";
import { PageHeader } from "../components/PageHeader";

export function OverviewPage() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const original = useSaveStore((s) => s.original)!;
  const warnings = useSaveStore((s) => s.warnings);
  const go = useNav((s) => s.go);

  const summary = useMemo(() => summarize(bytes, original), [bytes, original]);
  const party = getParty(bytes);
  const badges = getBadges(bytes).filter(Boolean).length;
  const time = getPlayTime(bytes);
  const bag = getBagItems(bytes).length;
  const pc = getPcItems(bytes).length;

  const stats: { label: string; value: string; to: PageId }[] = [
    { label: "Money", value: `¥${getMoney(bytes).toLocaleString()}`, to: "trainer" },
    { label: "Coins", value: getCoins(bytes).toLocaleString(), to: "trainer" },
    { label: "Badges", value: `${badges} / 8`, to: "trainer" },
    { label: "Party", value: `${party.length} / 6`, to: "party" },
    { label: "Bag items", value: `${bag}`, to: "items" },
    { label: "PC items", value: `${pc}`, to: "items" },
  ];

  return (
    <div className="page">
      <PageHeader title="Overview" subtitle="A snapshot of this save. Everything here is editable in its section." />

      <div className="overview__id">
        <div className="overview__trainer">
          <span className="overview__label">Trainer</span>
          <span className="overview__name">{getPlayerName(bytes) || "—"}</span>
          <span className="overview__meta mono">
            ID {getPlayerId(bytes).toString().padStart(5, "0")} · {String(time.hours).padStart(2, "0")}:
            {String(time.minutes).padStart(2, "0")} played
          </span>
        </div>
        <div className="overview__badges" aria-label={`${badges} of 8 badges`}>
          {BADGE_NAMES.map((name, i) => (
            <span
              key={name}
              className={`overview__badge ${getBadges(bytes)[i] ? "overview__badge--on" : ""}`}
              title={`${name}${getBadges(bytes)[i] ? "" : " (not earned)"}`}
            />
          ))}
        </div>
      </div>

      <div className="stat-grid">
        {stats.map((s) => (
          <button key={s.label} type="button" className="stat-card" onClick={() => go(s.to)}>
            <span className="stat-card__label">{s.label}</span>
            <span className="stat-card__value mono">{s.value}</span>
          </button>
        ))}
      </div>

      <div className="page__grid">
        <Panel
          title="Integrity"
          actions={
            summary.mismatches.length === 0 ? (
              <Badge tone="success">All valid</Badge>
            ) : (
              <Badge tone="warning">{summary.mismatches.length} to repair</Badge>
            )
          }
        >
          <dl className="kv">
            <div>
              <dt>Changed bytes</dt>
              <dd className="mono">{summary.dirtyBytes}</dd>
            </div>
            <div>
              <dt>Checksums repaired on export</dt>
              <dd className="mono">{summary.repairPreview.length}</dd>
            </div>
            <div>
              <dt>Current box</dt>
              <dd className="mono">#{getCurrentBoxIndex(bytes) + 1}</dd>
            </div>
          </dl>
          {summary.mismatches.length > 0 && (
            <p className="hint-line">
              These groups will be recomputed when you export. On a fresh save the PC box checksums are normally
              uninitialized until you first use the PC.
            </p>
          )}
        </Panel>

        <Panel title="Profile">
          <dl className="kv">
            <div>
              <dt>Data source</dt>
              <dd>shinpokered</dd>
            </div>
            <div>
              <dt>Tag</dt>
              <dd className="mono">{GAMEDATA_META.tag}</dd>
            </div>
            <div>
              <dt>Commit</dt>
              <dd className="mono">{String(GAMEDATA_META.commit).slice(0, 10)}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      {warnings.length > 0 && (
        <Panel title="Load notes">
          <ul className="notes">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
