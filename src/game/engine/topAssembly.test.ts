import { describe, expect, it } from "vitest";
import { createStarterEquipment } from "../data/topParts";
import { resolveTopRuntimeStats } from "./topAssembly";

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
});
