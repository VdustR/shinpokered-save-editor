import { describe, expect, it } from "vitest";
import { fuzzyScore, searchItems, searchMoves } from "./search";

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
