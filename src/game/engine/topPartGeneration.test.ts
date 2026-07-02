import { describe, expect, it } from "vitest";
import { createPartFromArenaDrop, generateTopPart, topPartAffixCountForRarity } from "./topPartGeneration";

describe("top part generation", () => {
  it("is deterministic for the same seed", () => {
    const first = generateTopPart({
      baseId: "part_ring_serrated_halo",
      rarity: "engraved",
      itemLevel: 12,
      seed: "repeatable-top-part",
      arenaId: "arena_red_chancel_disk",
      enemyLevel: 12,
      source: "drop",
    });
    const second = generateTopPart({
      baseId: "part_ring_serrated_halo",
      rarity: "engraved",
      itemLevel: 12,
      seed: "repeatable-top-part",
      arenaId: "arena_red_chancel_disk",
      enemyLevel: 12,
      source: "drop",
    });

    expect(first).toEqual(second);
  });

  it("respects prefix suffix and group limits", () => {
    const part = generateTopPart({
      baseId: "part_ring_serrated_halo",
      rarity: "relic",
      itemLevel: 18,
      seed: "limit-check",
      arenaId: "arena_red_chancel_disk",
      enemyLevel: 18,
      source: "drop",
    });
    const affixes = part.affixes ?? [];
    const groups = new Set(affixes.map((affix) => affix.group));

    expect(groups.size).toBe(affixes.length);
    expect(affixes.filter((affix) => affix.slot === "prefix").length).toBeLessThanOrEqual(3);
    expect(affixes.filter((affix) => affix.slot === "suffix").length).toBeLessThanOrEqual(3);
  });

  it("uses POE-style affix counts by rarity", () => {
    const tuned = generateTopPart({
      baseId: "part_ring_serrated_halo",
      rarity: "tuned",
      itemLevel: 18,
      seed: "poe-tuned",
      arenaId: "arena_red_chancel_disk",
      enemyLevel: 18,
      source: "drop",
    });
    const engraved = generateTopPart({
      baseId: "part_ring_serrated_halo",
      rarity: "engraved",
      itemLevel: 18,
      seed: "poe-engraved",
      arenaId: "arena_red_chancel_disk",
      enemyLevel: 18,
      source: "drop",
    });
    const relic = generateTopPart({
      baseId: "part_ring_serrated_halo",
      rarity: "relic",
      itemLevel: 18,
      seed: "poe-relic",
      arenaId: "arena_red_chancel_disk",
      enemyLevel: 18,
      source: "drop",
    });

    expect(topPartAffixCountForRarity("common")).toBe(0);
    expect(topPartAffixCountForRarity("tuned")).toBe(2);
    expect(topPartAffixCountForRarity("engraved")).toBe(6);
    expect(topPartAffixCountForRarity("relic")).toBe(0);
    expect(tuned.affixes?.filter((affix) => affix.slot === "prefix")).toHaveLength(1);
    expect(tuned.affixes?.filter((affix) => affix.slot === "suffix")).toHaveLength(1);
    expect(engraved.affixes?.filter((affix) => affix.slot === "prefix")).toHaveLength(3);
    expect(engraved.affixes?.filter((affix) => affix.slot === "suffix")).toHaveLength(3);
    expect(relic.affixes ?? []).toHaveLength(0);
  });

  it("uses the arena drop label to bias slot selection", () => {
    const part = createPartFromArenaDrop(
      {
        id: "drop_ring_test",
        label: "Attack Ring",
        slot: "attackRing",
        rarity: "engraved",
        x: 0,
        y: 0,
        age: 0,
      },
      3,
      4,
    );

    expect(part.slot).toBe("attackRing");
    expect(part.generatedBy?.source).toBe("drop");
  });

  it("uses explicit drop slots for named atlas rewards", () => {
    const cases = [
      { label: "Razor Ring", slot: "attackRing" },
      { label: "Orbit Disk", slot: "weightDisk" },
      { label: "Anchor Tip", slot: "tip" },
      { label: "Mapwright Chip", slot: "circuitChip" },
    ] as const;

    for (const entry of cases) {
      const part = createPartFromArenaDrop(
        {
          id: `drop_${entry.slot}_${entry.label}`,
          label: entry.label,
          slot: entry.slot,
          rarity: "tuned",
          x: 0,
          y: 0,
          age: 0,
        },
        3,
        4,
      );

      expect(part.slot).toBe(entry.slot);
    }
  });

  it("uses explicit drop base IDs for unique rewards", () => {
    const part = createPartFromArenaDrop(
      {
        id: "drop_unique_glass_rebound",
        label: "Glass Rebound Tip",
        slot: "tip",
        baseId: "part_tip_glass_rebound",
        rarity: "relic",
        x: 0,
        y: 0,
        age: 0,
      },
      3,
      4,
    );

    expect(part.baseId).toBe("part_tip_glass_rebound");
    expect(part.slot).toBe("tip");
    expect(part.rarity).toBe("relic");
  });
});
