/** Typed accessors over the generated game data (see scripts/generate-data.mjs). */
import gamedata from "../gen/gamedata.json";

export interface Evolution {
  kind: "level" | "item" | "trade";
  level?: number;
  item?: number;
  into: number;
}

export interface SpeciesEntry {
  internalId: number;
  name: string;
  /** 0 for MISSINGNO slots. */
  dexNo: number;
  evolutions: Evolution[];
  levelUpMoves: { level: number; move: number }[];
}

export interface PokemonEntry {
  dexNo: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  spc: number;
  types: [number, number];
  catchRate: number;
  expYield: number;
  growthRate: number;
  level0Moves: number[];
  /** TM numbers 1-50 plus HM numbers as 51-55. */
  tmhm: number[];
}

export interface MoveEntry {
  id: number;
  name: string;
  effect: string;
  power: number;
  type: number;
  accuracy: number;
  pp: number;
}

export interface ItemEntry {
  id: number;
  name: string;
  tm?: number;
  hm?: number;
  moveId?: number;
}

export const SPECIES: readonly SpeciesEntry[] = gamedata.species as SpeciesEntry[];
export const POKEMON: readonly PokemonEntry[] = gamedata.pokemon as PokemonEntry[];
export const MOVES: readonly MoveEntry[] = gamedata.moves as MoveEntry[];
export const ITEMS: readonly ItemEntry[] = gamedata.items as ItemEntry[];
export const TYPE_NAMES: Record<number, string> = gamedata.typeNames as Record<number, string>;
/** Move id for each TM/HM slot: index 0-49 = TM1-50, index 50-54 = HM1-5. */
export const TM_MOVES: readonly number[] = gamedata.tmMoves as number[];
export const GAMEDATA_META = gamedata.meta;
export const PROFILE_LABEL = `Gen 1 · Shin ${gamedata.meta.tag}`;

const speciesById = new Map(SPECIES.map((s) => [s.internalId, s]));
const pokemonByDexNo = new Map(POKEMON.map((p) => [p.dexNo, p]));
const moveById = new Map(MOVES.map((m) => [m.id, m]));
const itemById = new Map(ITEMS.map((i) => [i.id, i]));

export function speciesByInternalId(internalId: number): SpeciesEntry | undefined {
  return speciesById.get(internalId);
}

export function pokemonByDex(dexNo: number): PokemonEntry | undefined {
  return pokemonByDexNo.get(dexNo);
}

/** Base stats for an internal species id, resolved through its dex number. */
export function baseStatsOf(internalId: number): PokemonEntry | undefined {
  const species = speciesById.get(internalId);
  if (!species || species.dexNo === 0) return undefined;
  return pokemonByDexNo.get(species.dexNo);
}

export function moveInfo(moveId: number): MoveEntry | undefined {
  return moveById.get(moveId);
}

export function itemInfo(itemId: number): ItemEntry | undefined {
  return itemById.get(itemId);
}

export function moveName(moveId: number): string {
  if (moveId === 0) return "—";
  return moveById.get(moveId)?.name ?? `MOVE $${moveId.toString(16).padStart(2, "0")}`;
}

export function itemName(itemId: number): string {
  return itemById.get(itemId)?.name ?? `ITEM $${itemId.toString(16).padStart(2, "0")}`;
}

export function speciesName(internalId: number): string {
  return speciesById.get(internalId)?.name ?? `SPECIES $${internalId.toString(16).padStart(2, "0")}`;
}

export function typeName(typeId: number): string {
  return TYPE_NAMES[typeId] ?? `TYPE $${typeId.toString(16).padStart(2, "0")}`;
}

/** All species that occupy a real dex slot, sorted by dex number. */
export const DEX_SPECIES: readonly SpeciesEntry[] = [...SPECIES]
  .filter((s) => s.dexNo >= 1 && s.dexNo <= 151)
  .sort((a, b) => a.dexNo - b.dexNo);
