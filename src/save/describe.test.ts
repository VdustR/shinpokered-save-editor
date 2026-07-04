import { describe, expect, it } from "vitest";
import { formatMoveEffect } from "./describe";

describe("formatMoveEffect", () => {
  it("renders no additional effect as a dash", () => {
    expect(formatMoveEffect("NO_ADDITIONAL_EFFECT")).toBe("—");
  });

  it("turns effect constants into readable sentence case", () => {
    expect(formatMoveEffect("PARALYZE_SIDE_EFFECT1")).toBe("Paralyze side effect");
    expect(formatMoveEffect("ATTACK_UP2_EFFECT")).toBe("Attack up 2");
    expect(formatMoveEffect("TWO_TO_FIVE_ATTACKS_EFFECT")).toBe("Two to five attacks");
  });

  it("keeps an already-empty or unknown value safe", () => {
    expect(formatMoveEffect("")).toBe("—");
  });
});
