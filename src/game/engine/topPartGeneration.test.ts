import { describe, expect, it } from "vitest";
import { createPartFromArenaDrop, generateTopPart } from "./topPartGeneration";

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
});
