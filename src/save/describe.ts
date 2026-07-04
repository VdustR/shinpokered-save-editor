/** Human-readable descriptions derived from generated game-data constants. */

/**
 * Turn a move effect constant (e.g. `PARALYZE_SIDE_EFFECT1`) into a readable
 * label (`Paralyze side effect`). Trailing digits on the EFFECT token are the
 * game's internal variants, not meaningful to the reader, so they are dropped;
 * digits that are part of a word (e.g. `UP2`) are kept and spaced.
 */
export function formatMoveEffect(effect: string): string {
  if (!effect || effect === "NO_ADDITIONAL_EFFECT") return "—";
  let s = effect.replace(/\d+$/, ""); // drop the trailing variant number (EFFECT1 -> EFFECT)
  // "SIDE_EFFECT" is a meaningful phrase; a bare trailing "_EFFECT" is boilerplate.
  if (!/_SIDE_EFFECT$/.test(s)) s = s.replace(/_EFFECT$/, "");
  s = s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/([a-z])(\d)/g, "$1 $2") // "up2" -> "up 2"
    .replace(/\s+/g, " ")
    .trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "—";
}
