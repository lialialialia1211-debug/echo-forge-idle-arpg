import { describe, expect, it } from "vitest";
import { createStarterEquipment } from "../data/topParts";
import { resolveTopLoadoutBonuses, resolveTopRuntimeStats } from "./topAssembly";
import type { TopModifierDef, TopPartInstance, TopPartSlotId, TopStatBlock } from "./topTypes";

function makePart({
  id,
  baseId,
  slot,
  statBonuses,
  modifiers,
}: {
  id: string;
  baseId: string;
  slot: TopPartSlotId;
  statBonuses: TopStatBlock;
  modifiers: TopModifierDef[];
}): TopPartInstance {
  return {
    id,
    baseId,
    displayName: id,
    slot,
    rarity: "common",
    itemLevel: 1,
    statBonuses,
    resistanceBonuses: {},
    modifiers,
  };
}

describe("top assembly", () => {
  it("applies equipped part bonuses to runtime stats", () => {
    const naked = resolveTopRuntimeStats("frame_swift_razor", "drive_shard_barrage");
    const equipped = resolveTopRuntimeStats("frame_swift_razor", "drive_shard_barrage", {
      equipment: createStarterEquipment(),
    });

    expect(equipped.maxSpinIntegrity).toBeGreaterThan(naked.maxSpinIntegrity);
    expect(equipped.impact).toBeGreaterThan(naked.impact);
    expect(equipped.rpm).toBeGreaterThan(naked.rpm);
  });

  it("applies only compatible runes for the selected drive", () => {
    const noRune = resolveTopRuntimeStats("frame_storm_needle", "drive_storm_lattice");
    const withRune = resolveTopRuntimeStats("frame_storm_needle", "drive_storm_lattice", {
      runeIds: ["rune_shock_fork", "rune_red_heat"],
    });

    expect(withRune.tracking).toBeGreaterThan(noRune.tracking);
    expect(withRune.modifiers.some((modifier) => modifier.id.includes("rune_shock_fork"))).toBe(true);
    expect(withRune.modifiers.some((modifier) => modifier.id.includes("rune_red_heat"))).toBe(false);
  });

  it("applies allocated talent bonuses", () => {
    const base = resolveTopRuntimeStats("frame_ember_crucible", "drive_ember_scour");
    const talented = resolveTopRuntimeStats("frame_ember_crucible", "drive_ember_scour", {
      talentIds: ["talent_iron_rotation", "talent_furnace_scoring"],
    });

    expect(talented.maxSpinIntegrity).toBeGreaterThan(base.maxSpinIntegrity);
    expect(talented.resistances.heat).toBeGreaterThan(base.resistances.heat);
    expect(talented.modifiers.some((modifier) => modifier.id.includes("talent_furnace_scoring"))).toBe(true);
  });

  it("applies selected doctrine bonuses", () => {
    const base = resolveTopRuntimeStats("frame_ember_crucible", "drive_ember_scour");
    const doctrined = resolveTopRuntimeStats("frame_ember_crucible", "drive_ember_scour", {
      doctrineId: "doctrine_ember_rail_monk",
    });

    expect(doctrined.grip).toBeGreaterThan(base.grip);
    expect(doctrined.resistances.heat).toBeGreaterThan(base.resistances.heat);
    expect(doctrined.modifiers.some((modifier) => modifier.id.includes("doctrine_ember_rail_heat"))).toBe(true);
  });

  it("applies local modifiers to their source part before global modifier pooling", () => {
    const localModifier: TopModifierDef = { id: "scope_impact", stat: "impact", type: "increased", value: 1, tags: ["attack"], scope: "local" };
    const globalModifier: TopModifierDef = { id: "scope_impact", stat: "impact", type: "increased", value: 1, tags: ["attack"], scope: "global" };
    const otherPart = makePart({
      id: "other_tip",
      baseId: "part_tip_anchor",
      slot: "tip",
      statBonuses: { impact: 30 },
      modifiers: [],
    });

    const local = resolveTopLoadoutBonuses({
      equipment: {
        attackRing: makePart({
          id: "local_ring",
          baseId: "part_ring_serrated_halo",
          slot: "attackRing",
          statBonuses: { impact: 10 },
          modifiers: [localModifier],
        }),
        tip: otherPart,
      },
    });
    const global = resolveTopLoadoutBonuses({
      equipment: {
        attackRing: makePart({
          id: "global_ring",
          baseId: "part_ring_serrated_halo",
          slot: "attackRing",
          statBonuses: { impact: 10 },
          modifiers: [globalModifier],
        }),
        tip: otherPart,
      },
    });

    expect(local.statBonuses.impact).toBe(50);
    expect(local.modifiers.some((modifier) => modifier.id.includes("scope_impact"))).toBe(false);
    expect(global.statBonuses.impact).toBe(40);
    expect(global.modifiers.some((modifier) => modifier.id.includes("scope_impact"))).toBe(true);
  });
});
