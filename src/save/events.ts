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
}

export const EVENT_FLAGS: readonly EventFlag[] = (gamedata.eventFlags as [number, string][]).map(
  ([index, name]) => ({ index, name, label: eventFlagLabel(name) }),
);

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
