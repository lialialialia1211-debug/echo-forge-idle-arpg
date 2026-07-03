import { describe, expect, it } from "vitest";
import { advanceDropPity, dropRarityChancesForTier, minimumRarityFromPity, rollDropOutcome } from "./topDropRolls";

describe("top drop rolls", () => {
  it("uses tier rarity weights with a soft-capped rarity bonus", () => {
    const base = dropRarityChancesForTier(1, 0);
    const boosted = dropRarityChancesForTier(1, 1);
    const boostedRare = boosted.engraved + boosted.relic;
    const linearRare = 10 / (70 + 25 + 10);

    expect(base.common).toBeCloseTo(0.7, 3);
    expect(base.tuned).toBeCloseTo(0.25, 3);
    expect(base.engraved + base.relic).toBeCloseTo(0.05, 3);
    expect(boostedRare).toBeGreaterThan(base.engraved + base.relic);
    expect(boostedRare).toBeLessThan(linearRare);
  });

  it("promotes the next dropped part when pity thresholds are reached", () => {
    expect(minimumRarityFromPity({ killsSinceTuned: 12, killsSinceEngraved: 49 })).toBe("tuned");
    expect(minimumRarityFromPity({ killsSinceTuned: 12, killsSinceEngraved: 50 })).toBe("engraved");
    expect(advanceDropPity({ killsSinceTuned: 11, killsSinceEngraved: 49 }, "common")).toEqual({
      killsSinceTuned: 12,
      killsSinceEngraved: 50,
    });
    expect(advanceDropPity({ killsSinceTuned: 12, killsSinceEngraved: 50 }, "engraved")).toEqual({
      killsSinceTuned: 0,
      killsSinceEngraved: 0,
    });

    const drop = Array.from({ length: 40 }, (_, index) =>
      rollDropOutcome({
        arenaId: "arena_cinder_crucible",
        seed: `pity_seed_${index}`,
        wave: 1,
        killCount: index,
        playerPartQuantity: 20,
        playerPartRarity: 0,
        pity: { killsSinceTuned: 12, killsSinceEngraved: 50 },
      }),
    ).find(Boolean);

    expect(drop?.rarity === "engraved" || drop?.rarity === "relic").toBe(true);
  });
});
