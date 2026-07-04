import { describe, expect, it } from "vitest";
import { fuzzyScore, searchItems, searchMoves, searchSpecies } from "./search";

describe("fuzzyScore", () => {
  it("matches exact and substring, returns null for no match", () => {
    expect(fuzzyScore("thunder", "THUNDER")).not.toBeNull();
    expect(fuzzyScore("bolt", "THUNDERBOLT")).not.toBeNull();
    expect(fuzzyScore("xyz", "THUNDERBOLT")).toBeNull();
  });

  it("matches non-contiguous subsequences (typo-tolerant fuzzy)", () => {
    // t-b-t appears in order within THUNDERBOLT
    expect(fuzzyScore("tbt", "THUNDERBOLT")).not.toBeNull();
  });

  it("ranks a prefix/substring above a scattered subsequence", () => {
    const contiguous = fuzzyScore("thun", "THUNDER")!;
    const scattered = fuzzyScore("tdr", "THUNDER")!;
    expect(contiguous).toBeLessThan(scattered);
  });

  it("empty query matches everything with a neutral score", () => {
    expect(fuzzyScore("", "ANYTHING")).toBe(0);
  });

  it("ignores punctuation, gender glyphs, and accents on both sides", () => {
    expect(fuzzyScore("mr mime", "MR.MIME")).not.toBeNull();
    expect(fuzzyScore("nidoran m", "NIDORAN♂")).not.toBeNull();
    expect(fuzzyScore("nidoran f", "NIDORAN♀")).not.toBeNull();
    expect(fuzzyScore("poke ball", "POKé BALL")).not.toBeNull();
  });
});

describe("searchMoves", () => {
  it("fuzzy-matches by name", () => {
    const results = searchMoves({ query: "thunderbolt" });
    expect(results[0].name).toBe("THUNDERBOLT");
  });

  it("filters by type", () => {
    const electric = searchMoves({ query: "", type: 23 });
    expect(electric.length).toBeGreaterThan(0);
    expect(electric.every((m) => m.type === 23)).toBe(true);
  });

  it("sorts by power descending", () => {
    const byPower = searchMoves({ query: "", sort: "power", dir: "desc" });
    for (let i = 1; i < byPower.length; i++) {
      expect(byPower[i - 1].power).toBeGreaterThanOrEqual(byPower[i].power);
    }
  });

  it("sorts by accuracy and pp", () => {
    const byAcc = searchMoves({ query: "", sort: "accuracy", dir: "asc" });
    for (let i = 1; i < byAcc.length; i++) {
      expect(byAcc[i - 1].accuracy).toBeLessThanOrEqual(byAcc[i].accuracy);
    }
    const byPp = searchMoves({ query: "", sort: "pp", dir: "desc" });
    for (let i = 1; i < byPp.length; i++) {
      expect(byPp[i - 1].pp).toBeGreaterThanOrEqual(byPp[i].pp);
    }
  });

  it("combines a name query with a type filter", () => {
    const results = searchMoves({ query: "beam", type: 21 }); // water beams (BubbleBeam)
    expect(results.every((m) => m.type === 21)).toBe(true);
    expect(results.some((m) => m.name.includes("BEAM"))).toBe(true);
  });
});

describe("searchSpecies", () => {
  it("returns all 151 dex species by default, dex-ordered", () => {
    const all = searchSpecies({});
    expect(all).toHaveLength(151);
    expect(all[0].dexNo).toBe(1);
    expect(all[150].dexNo).toBe(151);
  });

  it("fuzzy-matches by name", () => {
    const r = searchSpecies({ query: "charizard" });
    expect(r[0].name).toBe("CHARIZARD");
  });

  it("ranks the shorter exact-ish match first (MEW before MEWTWO) even in dex sort", () => {
    const r = searchSpecies({ query: "mew", sort: "dex" });
    expect(r[0].name).toBe("MEW");
    expect(r.map((s) => s.name)).toContain("MEWTWO");
  });

  it("matches species with punctuation/gender glyphs via plain text", () => {
    expect(searchSpecies({ query: "mr mime" }).some((s) => s.name === "MR.MIME")).toBe(true);
    expect(searchSpecies({ query: "nidoran m" }).some((s) => s.name === "NIDORAN♂")).toBe(true);
  });

  it("filters by type", () => {
    const fire = searchSpecies({ type: 20 }); // FIRE
    expect(fire.length).toBeGreaterThan(0);
    expect(fire.some((s) => s.name === "CHARMANDER")).toBe(true);
    expect(fire.some((s) => s.name === "SQUIRTLE")).toBe(false);
  });

  it("sorts by dex, name, and base stat total", () => {
    const byDex = searchSpecies({ sort: "dex", dir: "asc" });
    expect(byDex[0].dexNo).toBe(1);
    const byName = searchSpecies({ sort: "name", dir: "asc" });
    for (let i = 1; i < byName.length; i++) {
      expect(byName[i - 1].name.localeCompare(byName[i].name)).toBeLessThanOrEqual(0);
    }
    const byBst = searchSpecies({ sort: "bst", dir: "desc" });
    for (let i = 1; i < byBst.length; i++) {
      expect(byBst[i - 1].bst).toBeGreaterThanOrEqual(byBst[i].bst);
    }
    // Mewtwo has the highest BST in Gen 1.
    expect(byBst[0].name).toBe("MEWTWO");
  });
});

describe("searchItems", () => {
  it("fuzzy-matches item names", () => {
    const results = searchItems({ query: "potion" });
    expect(results.some((i) => i.name === "POTION")).toBe(true);
  });

  it("filters TMs and HMs by category", () => {
    const tms = searchItems({ query: "", category: "tm" });
    expect(tms.length).toBe(50);
    expect(tms.every((i) => i.tm !== undefined)).toBe(true);
    const hms = searchItems({ query: "", category: "hm" });
    expect(hms.length).toBe(5);
  });
});
