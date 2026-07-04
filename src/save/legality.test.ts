import { describe, expect, it } from "vitest";
import { learnableMoves, moveLegality } from "./legality";
import { DEX_SPECIES, MOVES } from "./gamedata";

function id(name: string): number {
  return DEX_SPECIES.find((s) => s.name === name)!.internalId;
}
function move(name: string): number {
  return MOVES.find((m) => m.name === name)!.id;
}

describe("moveLegality", () => {
  it("marks a level-up move as legal via level-up", () => {
    // Bulbasaur starts with TACKLE / GROWL.
    expect(moveLegality(id("BULBASAUR"), move("TACKLE"))?.source).toBe("levelup");
  });

  it("marks a TM move as legal via TM", () => {
    // Bulbasaur learns Body Slam only from TM08 (not by level-up).
    expect(moveLegality(id("BULBASAUR"), move("BODY SLAM"))?.source).toBe("tm");
  });

  it("marks an HM move as legal via HM", () => {
    // Bulbasaur learns Cut (HM01).
    expect(moveLegality(id("BULBASAUR"), move("CUT"))?.source).toBe("hm");
  });

  it("marks an unlearnable move as illegal", () => {
    // Bulbasaur cannot legally learn Thunderbolt.
    expect(moveLegality(id("BULBASAUR"), move("THUNDERBOLT"))).toBeNull();
  });

  it("inherits pre-evolution moves (Venusaur can know a Bulbasaur-only move)", () => {
    // VINE WHIP is a Bulbasaur/Ivysaur level-up move; Venusaur keeps it via its line.
    const legal = moveLegality(id("VENUSAUR"), move("VINE WHIP"));
    expect(legal).not.toBeNull();
    expect(["levelup", "prevo"]).toContain(legal!.source);
  });
});

describe("learnableMoves", () => {
  it("returns a non-empty set that excludes clearly illegal moves", () => {
    const set = learnableMoves(id("BULBASAUR"));
    expect(set.size).toBeGreaterThan(4);
    expect(set.has(move("TACKLE"))).toBe(true);
    expect(set.has(move("THUNDERBOLT"))).toBe(false);
  });
});
