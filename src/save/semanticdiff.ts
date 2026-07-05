/**
 * Semantic diff between two parsed 32 KiB saves: grouped, human-readable
 * changes built on the same accessors the editor pages use, rather than raw
 * byte ranges. Sections with no differences are omitted.
 */
import { countDirtyBytes } from "./diff";
import { HIDDEN_COINS, HIDDEN_COINS_OFFSET, HIDDEN_ITEMS, HIDDEN_ITEMS_OFFSET, getHiddenFlag, hiddenSpotLabel } from "./hidden";
import { MISSABLE_BALLS, getMissable } from "./missables";
import { EVENT_FLAGS, UNNAMED_EVENT_FLAGS, getEventFlag } from "./events";
import { itemName, moveName, speciesName, DEX_SPECIES } from "./gamedata";
import { mapName, getPosition } from "./position";
import {
  BADGE_NAMES,
  getBadges,
  getBagItems,
  getCoins,
  getCurrentBoxIndex,
  getDayCare,
  exportSave,
  getMoney,
  getOptions,
  getParty,
  getPcItems,
  getPlayTime,
  getPlayerId,
  getPlayerName,
  getPlayerStarter,
  getRivalName,
  getRivalStarter,
  isDexOwned,
  isDexSeen,
  readBox,
  type ItemStack,
  type MonSlot,
} from "./savefile";
import { getRandomizerSeed, getShinFlags, getWinStreak, type ShinFlags } from "./shin";
import { TOWNS, getTownVisited } from "./towns";

export interface DiffEntry {
  label: string;
  from: string;
  to: string;
}

export interface DiffSection {
  title: string;
  entries: DiffEntry[];
}

const BOX_COUNT = 12;
const SHIN_FLAG_LABELS: Record<keyof ShinFlags, string> = {
  femaleTrainer: "Female trainer",
  sixtyFps: "60 fps mode",
  obedienceCap: "Obedience cap",
  nuzlocke: "Nuzlocke mode",
  gbcColors: "GBC colors",
};

function entry(label: string, from: unknown, to: unknown): DiffEntry {
  return { label, from: String(from), to: String(to) };
}

/** Push an entry when the two scalar values differ. */
function cmp(entries: DiffEntry[], label: string, a: unknown, b: unknown): void {
  if (a !== b) entries.push(entry(label, a, b));
}

function trainerSection(a: Uint8Array, b: Uint8Array): DiffSection {
  const entries: DiffEntry[] = [];
  cmp(entries, "Player name", getPlayerName(a), getPlayerName(b));
  cmp(entries, "Rival name", getRivalName(a), getRivalName(b));
  cmp(entries, "Trainer ID", getPlayerId(a), getPlayerId(b));
  cmp(entries, "Money", getMoney(a).toLocaleString("en-US"), getMoney(b).toLocaleString("en-US"));
  cmp(entries, "Coins", getCoins(a), getCoins(b));
  cmp(entries, "Win streak", getWinStreak(a), getWinStreak(b));
  cmp(entries, "Rival's starter", speciesName(getRivalStarter(a)), speciesName(getRivalStarter(b)));
  cmp(entries, "Your starter", speciesName(getPlayerStarter(a)), speciesName(getPlayerStarter(b)));
  cmp(entries, "Randomizer seed", getRandomizerSeed(a), getRandomizerSeed(b));

  const badgesA = getBadges(a);
  const badgesB = getBadges(b);
  BADGE_NAMES.forEach((name, bit) => {
    if (badgesA[bit] !== badgesB[bit])
      entries.push(entry(`${name} Badge`, badgesA[bit] ? "earned" : "—", badgesB[bit] ? "earned" : "—"));
  });

  const timeA = getPlayTime(a);
  const timeB = getPlayTime(b);
  const fmtTime = (t: ReturnType<typeof getPlayTime>) =>
    `${t.hours}:${String(t.minutes).padStart(2, "0")}:${String(t.seconds).padStart(2, "0")}`;
  cmp(entries, "Play time", fmtTime(timeA), fmtTime(timeB));

  const posA = getPosition(a);
  const posB = getPosition(b);
  cmp(
    entries,
    "Position",
    `${mapName(posA.map)} (${posA.x}, ${posA.y})`,
    `${mapName(posB.map)} (${posB.x}, ${posB.y})`,
  );

  const optA = getOptions(a);
  const optB = getOptions(b);
  cmp(entries, "Text speed", optA.textSpeed, optB.textSpeed);
  cmp(
    entries,
    "Battle animations",
    optA.battleAnimationOff ? "off" : "on",
    optB.battleAnimationOff ? "off" : "on",
  );
  cmp(entries, "Battle style", optA.battleStyleSet ? "Set" : "Shift", optB.battleStyleSet ? "Set" : "Shift");
  cmp(entries, "Current box", `Box ${getCurrentBoxIndex(a) + 1}`, `Box ${getCurrentBoxIndex(b) + 1}`);

  const shinA = getShinFlags(a);
  const shinB = getShinFlags(b);
  for (const key of Object.keys(SHIN_FLAG_LABELS) as (keyof ShinFlags)[]) {
    if (shinA[key] !== shinB[key])
      entries.push(entry(SHIN_FLAG_LABELS[key], shinA[key] ? "on" : "off", shinB[key] ? "on" : "off"));
  }

  return { title: "Trainer", entries };
}

function describeSlot(slot: MonSlot): string {
  const name = speciesName(slot.mon.species);
  const nick = slot.nickname && slot.nickname !== name ? ` “${slot.nickname}”` : "";
  return `${name}${nick} Lv${slot.mon.level}`;
}

/** Move list keeping slot positions: internal empties show as "—", trailing empties trimmed. */
function formatMoves(moves: readonly number[]): string {
  const named = moves.map((id) => (id ? moveName(id) : "—"));
  while (named.length && named[named.length - 1] === "—") named.pop();
  return named.join("/") || "—";
}

/** Field-level changes between two same-species slots (party, box, or day care). */
function monFieldChanges(sa: MonSlot, sb: MonSlot): string[] {
  const sub: string[] = [];
  if (sa.mon.level !== sb.mon.level) sub.push(`level ${sa.mon.level} → ${sb.mon.level}`);
  if (sa.nickname !== sb.nickname) sub.push(`nickname ${sa.nickname || "—"} → ${sb.nickname || "—"}`);
  const movesA = formatMoves(sa.mon.moves);
  const movesB = formatMoves(sb.mon.moves);
  if (movesA !== movesB) sub.push(`moves ${movesA} → ${movesB}`);
  if (sa.mon.pp.join() !== sb.mon.pp.join()) sub.push("PP changed");
  if (JSON.stringify(sa.mon.dvs) !== JSON.stringify(sb.mon.dvs)) sub.push("DVs changed");
  if (JSON.stringify(sa.mon.statExp) !== JSON.stringify(sb.mon.statExp)) sub.push("stat EXP changed");
  if (sa.mon.exp !== sb.mon.exp) sub.push(`EXP ${sa.mon.exp} → ${sb.mon.exp}`);
  if (sa.mon.currentHp !== sb.mon.currentHp) sub.push(`HP ${sa.mon.currentHp} → ${sb.mon.currentHp}`);
  if (sa.mon.status !== sb.mon.status) sub.push("status changed");
  return sub;
}

function monsSection(title: string, slotsA: MonSlot[], slotsB: MonSlot[]): DiffSection {
  const entries: DiffEntry[] = [];
  const max = Math.max(slotsA.length, slotsB.length);
  for (let i = 0; i < max; i++) {
    const sa = slotsA[i];
    const sb = slotsB[i];
    const label = `Slot ${i + 1}`;
    if (!sa && sb) {
      entries.push(entry(label, "empty", describeSlot(sb)));
      continue;
    }
    if (sa && !sb) {
      entries.push(entry(label, describeSlot(sa), "empty"));
      continue;
    }
    if (!sa || !sb) continue;
    if (sa.mon.species !== sb.mon.species) {
      entries.push(entry(label, describeSlot(sa), describeSlot(sb)));
      continue;
    }
    const sub = monFieldChanges(sa, sb);
    if (sub.length) entries.push(entry(`${label} ${speciesName(sa.mon.species)}`, "…", sub.join("; ")));
  }
  return { title, entries };
}

function boxesSection(a: Uint8Array, b: Uint8Array): DiffSection {
  const entries: DiffEntry[] = [];
  for (let box = 0; box < BOX_COUNT; box++) {
    const monsA = readBox(a, box).mons;
    const monsB = readBox(b, box).mons;
    // Multiset diff by species so reorders inside a box stay quiet.
    const countA = new Map<number, number>();
    const countB = new Map<number, number>();
    for (const s of monsA) countA.set(s.mon.species, (countA.get(s.mon.species) ?? 0) + 1);
    for (const s of monsB) countB.set(s.mon.species, (countB.get(s.mon.species) ?? 0) + 1);
    const species = new Set([...countA.keys(), ...countB.keys()]);
    const added: string[] = [];
    const removed: string[] = [];
    for (const id of species) {
      const delta = (countB.get(id) ?? 0) - (countA.get(id) ?? 0);
      if (delta > 0) added.push(delta > 1 ? `${speciesName(id)}×${delta}` : speciesName(id));
      if (delta < 0) removed.push(delta < -1 ? `${speciesName(id)}×${-delta}` : speciesName(id));
    }
    if (added.length || removed.length) {
      entries.push(
        entry(
          `Box ${box + 1}`,
          `${monsA.length} mon(s)`,
          [
            `${monsB.length} mon(s)`,
            added.length ? `+${added.join(", ")}` : "",
            removed.length ? `−${removed.join(", ")}` : "",
          ]
            .filter(Boolean)
            .join(" "),
        ),
      );
    }
  }
  return { title: "Boxes", entries };
}

function dayCareSection(a: Uint8Array, b: Uint8Array): DiffSection {
  const entries: DiffEntry[] = [];
  const dcA = getDayCare(a);
  const dcB = getDayCare(b);
  const label = (dc: ReturnType<typeof getDayCare>) =>
    dc.inUse && dc.mon ? describeSlot(dc.mon) : "empty";
  if (label(dcA) !== label(dcB)) {
    entries.push(entry("Day care", label(dcA), label(dcB)));
  } else if (dcA.mon && dcB.mon && dcA.mon.mon.species === dcB.mon.mon.species) {
    const sub = monFieldChanges(dcA.mon, dcB.mon);
    if (sub.length) entries.push(entry(`Day care ${speciesName(dcA.mon.mon.species)}`, "…", sub.join("; ")));
  }
  return { title: "Day care", entries };
}

function itemsSection(title: string, itemsA: ItemStack[], itemsB: ItemStack[]): DiffSection {
  const entries: DiffEntry[] = [];
  const qtyA = new Map<number, number>();
  const qtyB = new Map<number, number>();
  for (const s of itemsA) qtyA.set(s.id, (qtyA.get(s.id) ?? 0) + s.count);
  for (const s of itemsB) qtyB.set(s.id, (qtyB.get(s.id) ?? 0) + s.count);
  for (const id of new Set([...qtyA.keys(), ...qtyB.keys()])) {
    const av = qtyA.get(id) ?? 0;
    const bv = qtyB.get(id) ?? 0;
    if (av !== bv) entries.push(entry(itemName(id), `×${av}`, `×${bv}`));
  }
  return { title, entries };
}

function pokedexSection(a: Uint8Array, b: Uint8Array): DiffSection {
  const entries: DiffEntry[] = [];
  const changedOwned: string[] = [];
  const changedSeen: string[] = [];
  let ownedA = 0;
  let ownedB = 0;
  let seenA = 0;
  let seenB = 0;
  for (const sp of DEX_SPECIES) {
    const oa = isDexOwned(a, sp.dexNo);
    const ob = isDexOwned(b, sp.dexNo);
    const sa = isDexSeen(a, sp.dexNo);
    const sb = isDexSeen(b, sp.dexNo);
    if (oa) ownedA++;
    if (ob) ownedB++;
    if (sa) seenA++;
    if (sb) seenB++;
    if (oa !== ob) changedOwned.push(`${ob ? "+" : "−"}${sp.name}`);
    if (sa !== sb) changedSeen.push(`${sb ? "+" : "−"}${sp.name}`);
  }
  if (ownedA !== ownedB || changedOwned.length)
    entries.push(entry(`Owned (${listPreview(changedOwned)})`, ownedA, ownedB));
  if (seenA !== seenB || changedSeen.length)
    entries.push(entry(`Seen (${listPreview(changedSeen)})`, seenA, seenB));
  return { title: "Pokédex", entries };
}

function listPreview(items: string[], max = 6): string {
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} +${items.length - max} more`;
}

function flagsSection(a: Uint8Array, b: Uint8Array): DiffSection {
  const entries: DiffEntry[] = [];
  const changedNamed: string[] = [];
  for (const flag of EVENT_FLAGS) {
    const va = getEventFlag(a, flag.index);
    const vb = getEventFlag(b, flag.index);
    if (va !== vb) changedNamed.push(`${vb ? "+" : "−"}${flag.name}`);
  }
  let unnamedChanged = 0;
  for (const flag of UNNAMED_EVENT_FLAGS) {
    if (getEventFlag(a, flag.index) !== getEventFlag(b, flag.index)) unnamedChanged++;
  }
  if (changedNamed.length)
    entries.push(entry(`Story flags (${changedNamed.length})`, "…", listPreview(changedNamed)));
  if (unnamedChanged) entries.push(entry("Unnamed flags changed", "…", String(unnamedChanged)));

  const towns: string[] = [];
  for (const town of TOWNS) {
    const va = getTownVisited(a, town.mapId);
    const vb = getTownVisited(b, town.mapId);
    if (va !== vb) towns.push(`${vb ? "+" : "−"}${town.name}`);
  }
  if (towns.length) entries.push(entry("Visited towns", "…", listPreview(towns)));

  const hiddenItems: string[] = [];
  HIDDEN_ITEMS.forEach((spot, i) => {
    const va = getHiddenFlag(a, HIDDEN_ITEMS_OFFSET, i);
    const vb = getHiddenFlag(b, HIDDEN_ITEMS_OFFSET, i);
    if (va !== vb) hiddenItems.push(`${vb ? "+" : "−"}${hiddenSpotLabel(spot)}`);
  });
  if (hiddenItems.length) entries.push(entry("Hidden items collected", "…", listPreview(hiddenItems)));

  const hiddenCoins: string[] = [];
  HIDDEN_COINS.forEach((spot, i) => {
    const va = getHiddenFlag(a, HIDDEN_COINS_OFFSET, i);
    const vb = getHiddenFlag(b, HIDDEN_COINS_OFFSET, i);
    if (va !== vb) hiddenCoins.push(`${vb ? "+" : "−"}${hiddenSpotLabel(spot, "coins")}`);
  });
  if (hiddenCoins.length) entries.push(entry("Hidden coins collected", "…", listPreview(hiddenCoins)));

  const balls: string[] = [];
  for (const ball of MISSABLE_BALLS) {
    const va = getMissable(a, ball.index);
    const vb = getMissable(b, ball.index);
    if (va !== vb)
      balls.push(`${vb ? "+" : "−"}${ball.item !== null ? itemName(ball.item) : "?"} (${ball.map})`);
  }
  if (balls.length) entries.push(entry("Item balls taken", "…", listPreview(balls)));
  return { title: "Flags & world", entries };
}

/** Grouped human-readable differences from `a` to `b`; empty when identical. */
export function semanticDiff(a: Uint8Array, b: Uint8Array): DiffSection[] {
  const sections = [
    trainerSection(a, b),
    monsSection("Party", getParty(a), getParty(b)),
    boxesSection(a, b),
    dayCareSection(a, b),
    itemsSection("Bag", getBagItems(a), getBagItems(b)),
    itemsSection("PC items", getPcItems(a), getPcItems(b)),
    pokedexSection(a, b),
    flagsSection(a, b),
  ].filter((s) => s.entries.length > 0);

  // Compare export-quality copies so pending checksum repairs are counted;
  // the working buffer keeps stale checksum bytes until export.
  const dirty = countDirtyBytes(exportSave(a), exportSave(b));
  const rawDirty = countDirtyBytes(a, b);
  if (dirty > 0 || rawDirty > 0) {
    sections.push({
      title: "Raw",
      entries: [
        entry("Changed bytes as exported (including checksums)", "…", Math.max(dirty, rawDirty).toLocaleString("en-US")),
      ],
    });
  }
  return sections;
}
