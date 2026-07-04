/**
 * Generate game data for the editor from the shinpokered source tree.
 *
 * Facts (base stats, moves, items, names, learnsets, charmap) are parsed from
 * the assembly source at a pinned tag instead of being hand-copied, so a Shin
 * update only requires re-running this script against a new tag.
 *
 * Usage:
 *   SHINPOKERED_DIR=/path/to/shinpokered node scripts/generate-data.mjs
 *
 * Without SHINPOKERED_DIR the script clones the pinned tag into .cache/.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_URL = "https://github.com/jojobear13/shinpokered.git";
const PINNED_TAG = "1.25.0";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "src", "gen");

const srcDir = resolveSourceDir();
const commit = execFileSync("git", ["-C", srcDir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

function resolveSourceDir() {
  const fromEnv = process.env.SHINPOKERED_DIR;
  if (fromEnv) {
    if (!existsSync(path.join(fromEnv, "sram.asm"))) {
      throw new Error(`SHINPOKERED_DIR does not look like a shinpokered checkout: ${fromEnv}`);
    }
    return fromEnv;
  }
  const cacheDir = path.join(rootDir, ".cache", "shinpokered");
  if (!existsSync(path.join(cacheDir, "sram.asm"))) {
    mkdirSync(path.dirname(cacheDir), { recursive: true });
    execFileSync("git", ["clone", "--depth", "1", "--branch", PINNED_TAG, REPO_URL, cacheDir], {
      stdio: "inherit",
    });
  }
  return cacheDir;
}

function read(relPath) {
  return readFileSync(path.join(srcDir, relPath), "utf8");
}

/** Split a file into lines with comments stripped (asm `;` comments). */
function asmLines(relPath) {
  return read(relPath)
    .split("\n")
    .map((line) => {
      // Keep `;` inside double quotes (none of our inputs need it, but be safe).
      let out = "";
      let inString = false;
      for (const ch of line) {
        if (ch === '"') inString = !inString;
        if (ch === ";" && !inString) break;
        out += ch;
      }
      return out.trim();
    })
    .filter((line) => line.length > 0);
}

/** Parse `const NAME` / `const_value = $XX` sequences into name → value. */
function parseConstFile(relPath) {
  const values = new Map();
  let counter = 0;
  for (const line of asmLines(relPath)) {
    const assign = line.match(/^const_value\s*=\s*(\$?[0-9A-Fa-f]+)$/);
    if (assign) {
      counter = parseNumber(assign[1]);
      continue;
    }
    const named = line.match(/^const\s+([A-Za-z0-9_]+)$/);
    if (named) {
      values.set(named[1], counter);
      counter += 1;
      continue;
    }
    const equ = line.match(/^([A-Za-z0-9_]+)\s+EQU\s+(\$?[0-9A-Fa-f]+)$/);
    if (equ) values.set(equ[1], parseNumber(equ[2]));
  }
  return values;
}

function parseNumber(token) {
  if (token.startsWith("$")) return Number.parseInt(token.slice(1), 16);
  if (token.startsWith("%")) return Number.parseInt(token.slice(1), 2);
  return Number.parseInt(token, 10);
}

/** Parse in-order `db "TEXT@"` name tables. */
function parseNameTable(relPath) {
  const names = [];
  for (const line of asmLines(relPath)) {
    const match = line.match(/^db\s+"([^"]*)"$/);
    if (match) names.push(match[1].replace(/@+$/, ""));
  }
  return names;
}

const speciesConsts = parseConstFile("constants/pokemon_constants.asm");
const dexConsts = parseConstFile("constants/pokedex_constants.asm");
const moveConsts = parseConstFile("constants/move_constants.asm");
const itemConsts = parseConstFile("constants/item_constants.asm");
const typeConsts = parseConstFile("constants/type_constants.asm");
const evoConsts = parseConstFile("constants/evolution_constants.asm");

function resolveToken(token, ...tables) {
  if (/^(\$|%)?[0-9A-Fa-f]+$/.test(token) && /[0-9]/.test(token[0] === "$" || token[0] === "%" ? token[1] : token[0])) {
    return parseNumber(token);
  }
  for (const table of tables) {
    if (table.has(token)) return table.get(token);
  }
  throw new Error(`Unresolved token: ${token}`);
}

// --- Species names by internal index (1..190) ---------------------------------
const monsterNames = parseNameTable("text/monster_names.asm");
if (monsterNames.length !== 190) throw new Error(`Expected 190 monster names, got ${monsterNames.length}`);

// --- Internal index → dex number ----------------------------------------------
const dexOrder = [];
for (const line of asmLines("data/pokedex_order.asm")) {
  const match = line.match(/^db\s+(DEX_[A-Z0-9_]+|0)$/);
  if (match) dexOrder.push(match[1] === "0" ? 0 : dexConsts.get(match[1]));
}
if (dexOrder.length !== 190) throw new Error(`Expected 190 dex order entries, got ${dexOrder.length}`);

// --- Base stats per dex number -------------------------------------------------
const baseStatsFiles = read("data/base_stats.asm")
  .split("\n")
  .map((line) => line.match(/INCLUDE\s+"([^"]+)"/))
  .filter(Boolean)
  .map((match) => match[1]);

const pokemonByDex = new Map();
for (const file of baseStatsFiles) {
  const dbValues = [];
  const tmhm = [];
  for (const line of asmLines(file)) {
    const tm = line.match(/^tmlearn\s+([0-9,\s]+)$/);
    if (tm) {
      for (const n of tm[1].split(",")) tmhm.push(Number.parseInt(n.trim(), 10));
      continue;
    }
    const db = line.match(/^db\s+([A-Za-z0-9_$%]+)$/);
    if (db && !line.includes("BANK(")) dbValues.push(db[1]);
  }
  // First 15 db entries: dexno, 5 stats, 2 types, catch, exp, 4 lvl-0 moves, growth.
  if (dbValues.length < 15) throw new Error(`Unexpected base stats format: ${file}`);
  // Shin adds a base stats entry for MISSINGNO ($B5); the editor only needs dex 1-151.
  const dexNo = resolveToken(dbValues[0], dexConsts, speciesConsts);
  if (dexNo < 1 || dexNo > 151) continue;
  const stats = dbValues.slice(1, 6).map((v) => parseNumber(v));
  const types = dbValues.slice(6, 8).map((v) => resolveToken(v, typeConsts));
  const catchRate = parseNumber(dbValues[8]);
  const expYield = parseNumber(dbValues[9]);
  const level0Moves = dbValues.slice(10, 14).map((v) => resolveToken(v, moveConsts)).filter((v) => v !== 0);
  const growthRate = parseNumber(dbValues[14]);
  pokemonByDex.set(dexNo, {
    dexNo,
    hp: stats[0],
    atk: stats[1],
    def: stats[2],
    spd: stats[3],
    spc: stats[4],
    types,
    catchRate,
    expYield,
    growthRate,
    level0Moves,
    tmhm: tmhm.sort((a, b) => a - b),
  });
}
if (pokemonByDex.size !== 151) throw new Error(`Expected 151 base stats, got ${pokemonByDex.size}`);

// --- Evolutions and level-up learnsets by internal index -----------------------
const evosMovesLines = asmLines("data/evos_moves.asm");
const pointerOrder = [];
const blocks = new Map();
let currentLabel = null;
for (const line of evosMovesLines) {
  const pointer = line.match(/^dw\s+([A-Za-z0-9_]+EvosMoves)$/);
  if (pointer) {
    pointerOrder.push(pointer[1]);
    continue;
  }
  const label = line.match(/^([A-Za-z0-9_]+EvosMoves):+$/);
  if (label) {
    currentLabel = label[1];
    blocks.set(currentLabel, []);
    continue;
  }
  if (currentLabel && line.startsWith("db ")) {
    blocks.get(currentLabel).push(line.slice(3).split(",").map((token) => token.trim()));
  }
}
if (pointerOrder.length !== 190) throw new Error(`Expected 190 evos pointers, got ${pointerOrder.length}`);

const EV_LEVEL = evoConsts.get("EV_LEVEL");
const EV_ITEM = evoConsts.get("EV_ITEM");
const EV_TRADE = evoConsts.get("EV_TRADE");

function parseEvosMoves(label) {
  const rows = blocks.get(label) ?? [];
  const evolutions = [];
  const levelUpMoves = [];
  let inLearnset = false;
  for (const tokens of rows) {
    if (!inLearnset) {
      if (tokens.length === 1 && tokens[0] === "0") {
        inLearnset = true;
        continue;
      }
      const kind = resolveToken(tokens[0], evoConsts);
      if (kind === EV_LEVEL) {
        evolutions.push({ kind: "level", level: parseNumber(tokens[1]), into: resolveToken(tokens[2], speciesConsts) });
      } else if (kind === EV_ITEM) {
        evolutions.push({
          kind: "item",
          item: resolveToken(tokens[1], itemConsts),
          into: resolveToken(tokens[3], speciesConsts),
        });
      } else if (kind === EV_TRADE) {
        evolutions.push({ kind: "trade", into: resolveToken(tokens[2], speciesConsts) });
      } else {
        throw new Error(`Unknown evolution kind in ${label}: ${tokens.join(",")}`);
      }
    } else {
      if (tokens.length === 1 && tokens[0] === "0") break;
      levelUpMoves.push({ level: parseNumber(tokens[0]), move: resolveToken(tokens[1], moveConsts) });
    }
  }
  return { evolutions, levelUpMoves };
}

// --- Moves ----------------------------------------------------------------------
const moveNames = parseNameTable("text/move_names.asm");
const moves = [];
for (const line of asmLines("data/moves.asm")) {
  const match = line.match(/^move\s+(.+)$/);
  if (!match) continue;
  const args = match[1].split(",").map((token) => token.trim());
  const [name, effect, power, type, accuracy, pp] = args;
  const id = moveConsts.get(name);
  if (id === undefined) throw new Error(`Unknown move constant: ${name}`);
  moves.push({
    id,
    name: moveNames[id - 1],
    effect,
    power: parseNumber(power),
    type: resolveToken(type, typeConsts),
    accuracy: parseNumber(accuracy.replace(/\s*percent$/, "")),
    pp: parseNumber(pp),
  });
}
moves.sort((a, b) => a.id - b.id);
if (moves.length !== 165) throw new Error(`Expected 165 moves, got ${moves.length}`);

// --- TM/HM → move mapping ---------------------------------------------------------
const tmMoves = [];
for (const line of asmLines("data/tms.asm")) {
  const match = line.match(/^db\s+([A-Z0-9_]+)$/);
  if (match) tmMoves.push(resolveToken(match[1], moveConsts));
}
if (tmMoves.length !== 55) throw new Error(`Expected 55 TM/HM entries, got ${tmMoves.length}`);

// --- Items ------------------------------------------------------------------------
const itemNames = parseNameTable("text/item_names.asm");
const moveNameById = new Map(moves.map((move) => [move.id, move.name]));
const items = [];
for (let id = 1; id <= itemNames.length; id++) {
  items.push({ id, name: itemNames[id - 1] });
}
for (let hm = 0; hm < 5; hm++) {
  const moveId = tmMoves[50 + hm];
  items.push({ id: 0xc4 + hm, name: `HM${String(hm + 1).padStart(2, "0")} ${moveNameById.get(moveId)}`, hm: hm + 1, moveId });
}
for (let tm = 0; tm < 50; tm++) {
  const moveId = tmMoves[tm];
  items.push({ id: 0xc9 + tm, name: `TM${String(tm + 1).padStart(2, "0")} ${moveNameById.get(moveId)}`, tm: tm + 1, moveId });
}

// --- Item auto-sort order (ItemSortList in custom_functions/func_bag.asm) ----------------
const itemSortOrder = [];
{
  let inList = false;
  for (const line of asmLines("custom_functions/func_bag.asm")) {
    if (/^ItemSortList:+$/.test(line)) {
      inList = true;
      continue;
    }
    if (!inList) continue;
    // Entries are a bare item constant or an offset expression, e.g. `TM_01 + 3`.
    const db = line.match(/^db\s+([A-Za-z0-9_]+)(?:\s*\+\s*(\d+))?$/);
    if (db) {
      itemSortOrder.push(resolveToken(db[1], itemConsts) + (db[2] ? Number(db[2]) : 0));
      continue;
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*:+/.test(line)) break; // next label ends the list
  }
}
if (itemSortOrder.length < 50) throw new Error(`ItemSortList too short: ${itemSortOrder.length}`);

// --- Types ---------------------------------------------------------------------------
const typeNameLines = asmLines("text/type_names.asm");
const typePointerOrder = [];
const typeLabelNames = new Map();
for (const line of typeNameLines) {
  const pointer = line.match(/^dw\s+\.([A-Za-z]+)$/);
  if (pointer) typePointerOrder.push(pointer[1]);
  const label = line.match(/^\.([A-Za-z]+):+\s+db\s+"([^"]*)"$/);
  if (label) typeLabelNames.set(label[1], label[2].replace(/@+$/, ""));
}
const typeNames = {};
typePointerOrder.forEach((label, index) => {
  const name = typeLabelNames.get(label);
  if (name !== undefined && name !== "NORMAL") typeNames[index] = name;
  if (index === 0) typeNames[0] = "NORMAL";
});

// --- Charmap ----------------------------------------------------------------------------
const charmap = {};
for (const line of asmLines("charmap.asm")) {
  const match = line.match(/^charmap\s+"((?:[^"\\]|\\.)*)",\s*(\$[0-9A-Fa-f]+)$/);
  if (!match) continue;
  const token = match[1].replaceAll('\\"', '"');
  const code = parseNumber(match[2]);
  // Last definition wins where duplicates exist: the English table is defined
  // after the JP kana block and is authoritative for our target profile.
  charmap[code] = token;
}

// --- Species table (internal index keyed) ------------------------------------------------
const species = monsterNames.map((name, index) => {
  const internalId = index + 1;
  const dexNo = dexOrder[index];
  const { evolutions, levelUpMoves } = parseEvosMoves(pointerOrder[index]);
  return { internalId, name, dexNo, evolutions, levelUpMoves };
});

// --- Emit --------------------------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
const meta = {
  source: "github:jojobear13/shinpokered",
  tag: PINNED_TAG,
  commit,
  generator: "scripts/generate-data.mjs",
  note: "Generated file. Do not edit by hand; re-run the generator instead.",
};

const pokemon = [...pokemonByDex.values()].sort((a, b) => a.dexNo - b.dexNo);

writeFileSync(
  path.join(outDir, "gamedata.json"),
  JSON.stringify({ meta, species, pokemon, moves, items, typeNames, tmMoves, itemSortOrder, charmap }, null, 1),
);

console.log(`Generated src/gen/gamedata.json from ${meta.source}@${PINNED_TAG} (${commit.slice(0, 12)})`);
console.log(
  `species=${species.length} pokemon=${pokemon.length} moves=${moves.length} items=${items.length} charmap=${Object.keys(charmap).length}`,
);
