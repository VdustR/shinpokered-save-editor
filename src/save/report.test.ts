import { describe, expect, it } from "vitest";
import type { MonRecord } from "./pokemon";
import { legalityReport, minLearnLevel, tmLearnable } from "./report";
import { expForLevel } from "./stats";

const BULBASAUR = 153; // learns VINE WHIP (22) at level 13
const VENUSAUR = 154; // has VINE WHIP among its level-0 moves
const DITTO = 76; // only ever knows TRANSFORM (144)
const TACKLE = 33;
const GROWL = 45;
const VINE_WHIP = 22;
const TRANSFORM = 144;
const MEDIUM_SLOW = 3;

function mkMon(overrides: Partial<MonRecord> = {}): MonRecord {
  const level = overrides.level ?? 13;
  return {
    species: BULBASAUR,
    currentHp: 20,
    boxLevel: level,
    status: 0,
    types: [22, 3],
    catchRate: 45,
    moves: [TACKLE, GROWL, 0, 0],
    otId: 12345,
    exp: expForLevel(MEDIUM_SLOW, level),
    statExp: { hp: 0, atk: 0, def: 0, spd: 0, spc: 0 },
    dvs: { atk: 8, def: 8, spd: 8, spc: 8 },
    pp: [35, 40, 0, 0],
    level,
    ...overrides,
  };
}

function areas(mon: MonRecord) {
  return legalityReport(mon).map((f) => `${f.severity}:${f.area}`);
}

describe("minLearnLevel", () => {
  it("uses the species' own level-up entry", () => {
    expect(minLearnLevel(BULBASAUR, VINE_WHIP)).toBe(13);
  });

  it("treats level-0 starting moves as level 1", () => {
    expect(minLearnLevel(VENUSAUR, VINE_WHIP)).toBe(1);
    expect(minLearnLevel(BULBASAUR, TACKLE)).toBe(1);
  });

  it("returns null when no level-up path exists", () => {
    expect(minLearnLevel(DITTO, TACKLE)).toBeNull();
  });
});

describe("legalityReport", () => {
  it("reports nothing for a plain legal mon", () => {
    expect(legalityReport(mkMon())).toEqual([]);
  });

  it("flags glitch species and stops there", () => {
    const r = legalityReport(mkMon({ species: 255 }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ severity: "bad", area: "Species" });
  });

  it("flags out-of-range levels", () => {
    expect(areas(mkMon({ level: 145 }))).toContain("bad:Level");
  });

  it("flags EXP that does not match the level", () => {
    const r = legalityReport(mkMon({ exp: 5 }));
    const exp = r.find((f) => f.area === "EXP");
    expect(exp?.severity).toBe("warn");
    expect(exp?.message).toMatch(/level 1\b/);
  });

  it("flags unlearnable moves", () => {
    const r = legalityReport(mkMon({ moves: [TRANSFORM, 0, 0, 0], pp: [16, 0, 0, 0] }));
    expect(r.some((f) => f.area === "Moves" && f.severity === "warn")).toBe(true);
  });

  it("applies no level floor to moves also learnable by TM", () => {
    // MEWTWO learns PSYCHIC (94) at level 66 by level-up but also via TM;
    // BARRIER (112, level 63) has no TM path and keeps its floor.
    const MEWTWO = 131;
    const PSYCHIC = 94;
    const BARRIER = 112;
    const FAST_THEN_SLOW = 5;
    expect(tmLearnable(MEWTWO, PSYCHIC)).toBe(true);
    expect(tmLearnable(MEWTWO, BARRIER)).toBe(false);
    const mk = (move: number) =>
      mkMon({
        species: MEWTWO,
        level: 50,
        exp: expForLevel(FAST_THEN_SLOW, 50),
        types: [24, 24],
        catchRate: 3,
        moves: [move, 0, 0, 0],
        pp: [10, 0, 0, 0],
      });
    expect(legalityReport(mk(PSYCHIC)).filter((f) => f.area === "Moves")).toEqual([]);
    expect(
      legalityReport(mk(BARRIER)).some((f) => f.area === "Moves" && /level 63/.test(f.message)),
    ).toBe(true);
  });

  it("checks boxed current HP against the derived max", () => {
    const r = legalityReport(mkMon({ currentHp: 500 })); // no stats/maxHp: box shape
    const hp = r.find((f) => f.area === "Stats");
    expect(hp?.severity).toBe("warn");
    expect(hp?.message).toMatch(/derived max HP/);
  });

  it("flags a level-up move known below its learn level", () => {
    const r = legalityReport(
      mkMon({ level: 5, exp: expForLevel(MEDIUM_SLOW, 5), moves: [VINE_WHIP, 0, 0, 0], pp: [10, 0, 0, 0] }),
    );
    const m = r.find((f) => f.area === "Moves");
    expect(m?.severity).toBe("warn");
    expect(m?.message).toMatch(/level 13/);
  });

  it("flags duplicate moves and empty movesets as bad", () => {
    expect(areas(mkMon({ moves: [TACKLE, TACKLE, 0, 0] }))).toContain("bad:Moves");
    expect(areas(mkMon({ moves: [0, 0, 0, 0], pp: [0, 0, 0, 0] }))).toContain("bad:Moves");
  });

  it("flags PP above the max for the PP Up count", () => {
    // TACKLE has 35 base PP; 40 current with 0 ups is impossible.
    expect(areas(mkMon({ pp: [40, 40, 0, 0] }))).toContain("bad:PP");
  });

  it("notes stored type/catch-rate overrides as info", () => {
    expect(areas(mkMon({ types: [20, 3] }))).toContain("info:Types");
    expect(areas(mkMon({ catchRate: 3 }))).toContain("info:Catch rate");
  });

  it("flags party stats that disagree with the stat formula", () => {
    const r = legalityReport(
      mkMon({ maxHp: 999, stats: { atk: 999, def: 1, spd: 1, spc: 1 } }),
    );
    const s = r.find((f) => f.area === "Stats");
    expect(s?.severity).toBe("warn");
    expect(s?.message).toMatch(/HP 999/);
  });

  it("flags names the charmap cannot encode", () => {
    const r = legalityReport(mkMon(), { nickname: "字", otName: "RED" });
    expect(r.some((f) => f.area === "Names" && f.severity === "bad")).toBe(true);
  });
});
