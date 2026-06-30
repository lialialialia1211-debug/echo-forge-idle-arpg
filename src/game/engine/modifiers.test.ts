import { describe, expect, it } from "vitest";
import { hitChanceFromRatings, resolveStat } from "./modifiers";
import type { ModifierDef } from "./types";

describe("modifier algebra", () => {
  it("keeps increased additive and more multiplicative", () => {
    const modifiers: ModifierDef[] = [
      { id: "inc_a", stat: "damage", type: "increased", value: 0.4, source: "passive" },
      { id: "inc_b", stat: "damage", type: "increased", value: 0.2, source: "item" },
      { id: "more_a", stat: "damage", type: "more", value: 0.25, source: "support" },
    ];

    expect(resolveStat(100, modifiers, "damage")).toBeCloseTo(200);
  });

  it("matches tagged modifiers only when the skill has a matching tag", () => {
    const modifiers: ModifierDef[] = [
      { id: "spell_bonus", stat: "damage", type: "increased", value: 1, source: "item", tags: ["spell"] },
    ];

    expect(resolveStat(100, modifiers, "damage", ["attack"])).toBe(100);
    expect(resolveStat(100, modifiers, "damage", ["spell"])).toBe(200);
  });

  it("clamps hit chance to useful bounds", () => {
    expect(hitChanceFromRatings(1, 100000)).toBeCloseTo(0.05);
    expect(hitChanceFromRatings(100000, 1)).toBeCloseTo(0.95);
  });
});
