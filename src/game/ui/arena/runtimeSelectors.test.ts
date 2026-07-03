import { describe, expect, it } from "vitest";
import { createTopArenaRuntime } from "../../engine/arenaRuntime";
import { createProjectionEnemyStats, projectTopCombat } from "../../engine/topCombat";
import { zeroResistances } from "../../engine/topTypes";
import { isFeatureUnlocked, selectBreakpointStatus, selectDpsBreakdown, selectVisibleNetworkNodeIds, selectVisibleRunes, shouldCollapseCircuitAtlas } from "./runtimeSelectors";

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

  it("uses live target stats when a combat target is provided", () => {
    const arenaId = "arena_cinder_crucible";
    const frameId = "frame_swift_razor";
    const driveId = "drive_shard_barrage";
    const runtime = createTopArenaRuntime({
      arenaId,
      frameId,
      driveId,
      loadout: {},
      seed: "selector_live_target_test",
    });
    const baseTarget = createProjectionEnemyStats(arenaId);
    const weakTarget = { ...baseTarget, guard: 0, drift: 0, resistances: zeroResistances() };
    const armoredTarget = { ...baseTarget, guard: 8000, drift: 8000, resistances: zeroResistances() };

    const weakBreakdown = selectDpsBreakdown(runtime.player, [], driveId, { arenaId, frameId, driveId, loadout: {}, targetStats: weakTarget, targetName: "Weak Target" });
    const armoredBreakdown = selectDpsBreakdown(runtime.player, [], driveId, { arenaId, frameId, driveId, loadout: {}, targetStats: armoredTarget, targetName: "Armored Target" });

    expect(weakBreakdown.targetName).toBe("Weak Target");
    expect(armoredBreakdown.targetName).toBe("Armored Target");
    expect(weakBreakdown.collisionDps).toBeGreaterThan(armoredBreakdown.collisionDps);
    expect(weakBreakdown.driveDps).toBeGreaterThan(armoredBreakdown.driveDps);
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

  it("unlocks progressive features from seen tutorials or live triggers", () => {
    expect(isFeatureUnlocked("forge", { seenTutorialIds: ["tut_first_forge"], activeTutorialTriggers: {} })).toBe(true);
    expect(isFeatureUnlocked("forge", { seenTutorialIds: [], activeTutorialTriggers: { firstForge: true } })).toBe(true);
    expect(isFeatureUnlocked("forge", { seenTutorialIds: [], activeTutorialTriggers: { firstRune: true } })).toBe(false);
    expect(isFeatureUnlocked("wallet", { seenTutorialIds: ["tut_first_forge"], activeTutorialTriggers: {} })).toBe(true);
  });

  it("keeps route fog to unlocked nodes and the next reachable layer", () => {
    const visible = selectVisibleNetworkNodeIds(
      [
        { id: "root", displayName: "Root", description: "", arenaId: "arena_cinder_crucible" },
        { id: "branch", displayName: "Branch", description: "", arenaId: "arena_cinder_crucible", requiredNodeIds: ["root"] },
        { id: "deep", displayName: "Deep", description: "", arenaId: "arena_cinder_crucible", requiredNodeIds: ["branch"] },
      ],
      new Set(["root"]),
    );

    expect(visible.has("root")).toBe(true);
    expect(visible.has("branch")).toBe(true);
    expect(visible.has("deep")).toBe(false);
  });

  it("collapses empty atlas and filters rune catalog to owned runes", () => {
    expect(shouldCollapseCircuitAtlas(0, [])).toBe(true);
    expect(shouldCollapseCircuitAtlas(1, [])).toBe(false);
    expect(shouldCollapseCircuitAtlas(0, ["atlas_root"])).toBe(false);

    const runes = [
      { id: "owned", displayName: "Owned", requiredTags: [], modifiers: [] },
      { id: "hidden", displayName: "Hidden", requiredTags: [], modifiers: [] },
    ];

    expect(selectVisibleRunes(runes, new Set(["owned"]), false).map((rune) => rune.id)).toEqual(["owned"]);
    expect(selectVisibleRunes(runes, new Set(["owned"]), true).map((rune) => rune.id)).toEqual(["owned", "hidden"]);
  });
});
