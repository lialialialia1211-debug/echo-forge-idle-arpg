import { describe, expect, it } from "vitest";
import { generateArenaKey, isArenaKeyLegal, summarizeArenaKeyRiskReward } from "./arenaKeys";

describe("arena keys", () => {
  it("generates deterministic key items", () => {
    const first = generateArenaKey({
      arenaBaseId: "arena_red_chancel_disk",
      tier: 3,
      rarity: "engraved",
      seed: "key-seed",
    });
    const second = generateArenaKey({
      arenaBaseId: "arena_red_chancel_disk",
      tier: 3,
      rarity: "engraved",
      seed: "key-seed",
    });

    expect(first).toEqual(second);
    expect(isArenaKeyLegal(first)).toBe(true);
  });

  it("summarizes risk and reward from affixes", () => {
    const key = generateArenaKey({
      arenaBaseId: "arena_red_chancel_disk",
      tier: 3,
      rarity: "relic",
      seed: "risk-seed",
      quality: 12,
    });
    const summary = summarizeArenaKeyRiskReward(key);

    expect(summary.rewardQuantity).toBeGreaterThan(0);
    expect(summary.enemyIntegrityMultiplier).toBeGreaterThanOrEqual(1);
  });
});
