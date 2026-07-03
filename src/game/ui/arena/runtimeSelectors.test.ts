import { describe, expect, it } from "vitest";
import { createTopArenaRuntime } from "../../engine/arenaRuntime";
import { projectTopCombat } from "../../engine/topCombat";
import { selectBreakpointStatus, selectDpsBreakdown } from "./runtimeSelectors";

describe("arena runtime selectors", () => {
  it("uses the same projected DPS components as the combat engine", () => {
    const arenaId = "arena_red_chancel_disk";
    const frameId = "frame_swift_razor";
    const driveId = "drive_shard_barrage";
    const loadout = {};
    const runtime = createTopArenaRuntime({
      arenaId,
      frameId,
      driveId,
      loadout,
      seed: "selector_dps_projection_test",
    });

    const breakdown = selectDpsBreakdown(runtime.player, [], driveId, { arenaId, frameId, driveId, loadout });
    const projection = projectTopCombat({ arenaId, frameId, driveId, loadout });

    expect(breakdown.collisionDps).toBe(projection.collisionDps);
    expect(breakdown.driveDps).toBe(projection.driveDps);
    expect(breakdown.dotDps).toBe(projection.dotDps);
    expect(breakdown.totalDps).toBe(projection.totalDps);
  });

  it("marks less-threshold breakpoints as penalties", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_storm_needle",
      driveId: "drive_storm_lattice",
      loadout: { talentIds: ["talent_keystone_overload_bearing"] },
      seed: "selector_penalty_breakpoint_test",
    });

    const statuses = selectBreakpointStatus(runtime.player, "drive_storm_lattice");
    const penalty = statuses.find((status) => status.sourceId.includes("talent_keystone_overload_less"));

    expect(penalty).toBeTruthy();
    expect(penalty?.penalty).toBe(true);
  });
});
