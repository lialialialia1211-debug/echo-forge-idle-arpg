import { describe, expect, it } from "vitest";
import { validateRuneLoadout } from "./driveRuneValidation";

describe("drive rune validation", () => {
  it("accepts only compatible required tags", () => {
    const validation = validateRuneLoadout("drive_storm_lattice", ["rune_shock_fork", "rune_red_heat"]);

    expect(validation.validRuneIds).toEqual(["rune_shock_fork"]);
    expect(validation.issues.some((issue) => issue.reason === "incompatible")).toBe(true);
  });

  it("blocks duplicate rune families", () => {
    const validation = validateRuneLoadout("drive_shard_barrage", ["rune_splintered_edge", "rune_splintered_edge"]);

    expect(validation.validRuneIds).toEqual(["rune_splintered_edge"]);
    expect(validation.issues.some((issue) => issue.reason === "duplicate")).toBe(true);
  });
});
