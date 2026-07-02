import { describe, expect, it } from "vitest";
import { generateTopPart } from "./topPartGeneration";
import {
  addRandomEngraving,
  isTopPartLegal,
  removeRandomEngraving,
  rerollTopPartValues,
  salvageTopPart,
  upgradeTopPartRarity,
} from "./topCrafting";

function makePart() {
  return generateTopPart({
    baseId: "part_ring_serrated_halo",
    rarity: "tuned",
    itemLevel: 10,
    seed: "craft-source",
    arenaId: "arena_glass_mire_basin",
    enemyLevel: 10,
    source: "drop",
  });
}

describe("top crafting", () => {
  it("does not salvage locked parts", () => {
    const part = { ...makePart(), locked: true };

    expect(() => salvageTopPart(part)).toThrow("Locked");
  });

  it("upgrades rarity and keeps the part legal", () => {
    const result = upgradeTopPartRarity(makePart(), "upgrade-seed");
    const upgraded = result.part;

    expect(upgraded.rarity).toBe("engraved");
    expect(result.spent).toEqual({ ash: 6, glass: 1, echo: 0 });
    expect(isTopPartLegal(upgraded)).toBe(true);
  });

  it("uses the relic upgrade price only for the final rarity step", () => {
    const engraved = generateTopPart({
      baseId: "part_ring_serrated_halo",
      rarity: "engraved",
      itemLevel: 10,
      seed: "engraved-source",
      arenaId: "arena_glass_mire_basin",
      enemyLevel: 10,
      source: "drop",
    });

    const result = upgradeTopPartRarity(engraved, "relic-upgrade-seed");

    expect(result.part.rarity).toBe("relic");
    expect(result.spent).toEqual({ ash: 18, glass: 5, echo: 1 });
    expect(isTopPartLegal(result.part)).toBe(true);
  });

  it("does not spend currency when a relic has no higher rarity", () => {
    const relic = generateTopPart({
      baseId: "part_ring_serrated_halo",
      rarity: "relic",
      itemLevel: 10,
      seed: "relic-source",
      arenaId: "arena_glass_mire_basin",
      enemyLevel: 10,
      source: "drop",
    });

    const result = upgradeTopPartRarity(relic, "blocked-upgrade-seed");

    expect(result.part).toBe(relic);
    expect(result.spent).toEqual({ ash: 0, glass: 0, echo: 0 });
  });

  it("can reroll values while preserving affix identities", () => {
    const part = makePart();
    const rerolled = rerollTopPartValues(part, "value-seed").part;

    expect((rerolled.affixes ?? []).map((affix) => affix.engravingId)).toEqual((part.affixes ?? []).map((affix) => affix.engravingId));
    expect(isTopPartLegal(rerolled)).toBe(true);
  });

  it("can add and remove engravings legally", () => {
    const added = addRandomEngraving(makePart(), "add-seed").part;
    const removed = removeRandomEngraving(added, "remove-seed").part;

    expect((added.affixes ?? []).length).toBeGreaterThan((makePart().affixes ?? []).length);
    expect((removed.affixes ?? []).length).toBe((added.affixes ?? []).length - 1);
    expect(isTopPartLegal(added)).toBe(true);
    expect(isTopPartLegal(removed)).toBe(true);
  });
});
