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
    const upgraded = upgradeTopPartRarity(makePart(), "upgrade-seed").part;

    expect(upgraded.rarity).toBe("engraved");
    expect(isTopPartLegal(upgraded)).toBe(true);
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
