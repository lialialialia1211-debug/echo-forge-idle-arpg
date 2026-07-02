import { describe, expect, it } from "vitest";
import { arenaKeyAffixCountForRarity, generateArenaKey, isArenaKeyLegal, summarizeArenaKeyRiskReward } from "./arenaKeys";

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

  it("uses POE-style affix counts by rarity", () => {
    const tuned = generateArenaKey({
      arenaBaseId: "arena_red_chancel_disk",
      tier: 3,
      rarity: "tuned",
      seed: "key-tuned",
    });
    const engraved = generateArenaKey({
      arenaBaseId: "arena_red_chancel_disk",
      tier: 3,
      rarity: "engraved",
      seed: "key-engraved",
    });
    const relic = generateArenaKey({
      arenaBaseId: "arena_red_chancel_disk",
      tier: 3,
      rarity: "relic",
      seed: "key-relic",
    });

    expect(arenaKeyAffixCountForRarity("common")).toBe(0);
    expect(arenaKeyAffixCountForRarity("tuned")).toBe(2);
    expect(arenaKeyAffixCountForRarity("engraved")).toBe(6);
    expect(arenaKeyAffixCountForRarity("relic")).toBe(0);
    expect(tuned.prefixes).toHaveLength(1);
    expect(tuned.suffixes).toHaveLength(1);
    expect(engraved.prefixes).toHaveLength(3);
    expect(engraved.suffixes).toHaveLength(3);
    expect([...relic.prefixes, ...relic.suffixes]).toHaveLength(0);
  });
});
