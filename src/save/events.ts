/**
 * Story/event flags: wEventFlags is a 320-byte bit array at d747
 * (file 0x29f3). Indices are sequential bit numbers; the named subset comes
 * from shinpokered constants/event_constants.asm via the data generator.
 */
import gamedata from "../gen/gamedata.json";

export const EVENT_FLAGS_OFFSET = 0x25a3 + (0xd747 - 0xd2f7); // 0x29f3
export const EVENT_FLAGS_BYTES = 320;

export interface EventFlag {
  index: number;
  name: string;
  /** Precomputed display label so list renders don't re-derive it. */
  label: string;
  /** Source files (basenames) that reference this bit, for unnamed-but-used flags. */
  usedIn?: string[];
}

export const EVENT_FLAGS: readonly EventFlag[] = (gamedata.eventFlags as [number, string][]).map(
  ([index, name]) => ({ index, name, label: eventFlagLabel(name) }),
);

interface FlagUsage {
  files: string[];
  note?: string;
}

const FLAG_USAGE = (gamedata.eventFlagUsage ?? {}) as Record<string, FlagUsage>;

/** Nuzlocke encounter-area bits are computed as EVENT_980 + list index. */
const NUZLOCKE_FLAG_BASE = 0x980;
const NUZLOCKE_AREAS = (gamedata.nuzlockeAreas ?? []) as string[];

/**
 * The bits event_constants.asm leaves placeholder-named, with semantics
 * derived from a code cross-reference: some are used without ever being
 * renamed (the label carries the usage comment and files), the Nuzlocke
 * encounter-area range is addressed indirectly (base + list index), and the
 * rest are verified unused by any game code, so toggling them has no effect.
 */
export const UNNAMED_EVENT_FLAGS: readonly EventFlag[] = (() => {
  const named = new Set(EVENT_FLAGS.map((flag) => flag.index));
  const out: EventFlag[] = [];
  for (let i = 0; i < EVENT_FLAGS_BYTES * 8; i++) {
    if (named.has(i)) continue;
    const hex = i.toString(16).toUpperCase().padStart(3, "0");
    const nuzlockeIndex = i - NUZLOCKE_FLAG_BASE;
    const area = nuzlockeIndex >= 0 && nuzlockeIndex < NUZLOCKE_AREAS.length ? NUZLOCKE_AREAS[nuzlockeIndex] : null;
    const usage = FLAG_USAGE[i];
    if (area) {
      out.push({
        index: i,
        name: `EVENT_${hex}`,
        label: `Nuzlocke encounter used — ${area} ($${hex})`,
        usedIn: ["func_nuzlocke"],
      });
    } else if (usage) {
      const hint = usage.note ?? `used in ${usage.files[0]}`;
      out.push({ index: i, name: `EVENT_${hex}`, label: `Unnamed $${hex} — ${hint}`, usedIn: usage.files });
    } else {
      out.push({ index: i, name: `EVENT_${hex}`, label: `Unnamed $${hex} (unused)` });
    }
  }
  return out;
})();

export function eventFlagByteOffset(index: number): number {
  return EVENT_FLAGS_OFFSET + (index >> 3);
}

export function getEventFlag(bytes: Uint8Array, index: number): boolean {
  return (bytes[eventFlagByteOffset(index)] & (1 << (index & 7))) !== 0;
}

export function setEventFlag(bytes: Uint8Array, index: number, value: boolean): void {
  const offset = eventFlagByteOffset(index);
  const mask = 1 << (index & 7);
  if (value) bytes[offset] |= mask;
  else bytes[offset] &= ~mask;
}

/** "EVENT_GOT_TOWN_MAP" -> "Got town map" (plain sentence case, no magic). */
export function eventFlagLabel(name: string): string {
  const words = name.replace(/^EVENT_/, "").toLowerCase().split("_");
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
