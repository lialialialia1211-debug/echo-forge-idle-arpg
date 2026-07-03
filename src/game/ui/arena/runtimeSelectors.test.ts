import { describe, expect, it } from "vitest";
import { getDriveCoreDef } from "../../data/driveCores";
import { getTuningRuneDef } from "../../data/tuningRunes";
import { createTopArenaRuntime } from "../../engine/arenaRuntime";
import { resolveTopRuntimeStats } from "../../engine/topAssembly";
import { createProjectionEnemyStats, projectTopCombat } from "../../engine/topCombat";
import { zeroResistances } from "../../engine/topTypes";
import { isFeatureUnlocked, selectBreakpointStatus, selectBuildArchetypeProjection, selectDpsBreakdown, selectRecommendedRunes, selectRouteStrategyProjection, selectRouteStrategyRecommendations, selectVisibleNetworkNodeIds, selectVisibleRunes, shouldCollapseCircuitAtlas } from "./runtimeSelectors";

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

  it("projects route strategy from build readiness, reward, and unlock state", () => {
    const safe = selectRouteStrategyProjection({
      node: { id: "root", displayName: "Root", description: "", arenaId: "arena_cinder_crucible" },
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      unlockedNodeIds: new Set(["root"]),
      clearedBossGateIds: [],
      clearedRivalIds: [],
      partQuantity: 0.25,
    });
    const locked = selectRouteStrategyProjection({
      node: { id: "locked", displayName: "Locked", description: "", arenaId: "arena_resonant_apex", requiredBossGateId: "boss_gate_brass_judicator" },
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      unlockedNodeIds: new Set(["root"]),
      clearedBossGateIds: [],
      clearedRivalIds: [],
    });
    const dangerous = selectRouteStrategyProjection({
      node: { id: "deep", displayName: "Deep", description: "", arenaId: "arena_resonant_apex", anomalyId: "anomaly_resonant_crush" },
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      unlockedNodeIds: new Set(["deep"]),
      clearedBossGateIds: ["boss_gate_brass_judicator"],
      clearedRivalIds: [],
    });

    expect(safe.action).not.toBe("locked");
    expect(safe.idleScore).toBeGreaterThan(0.5);
    expect(safe.offline.killsPerHour).toBeGreaterThan(0);
    expect(safe.offline.dropsPerHour).toBeGreaterThan(0);
    expect(safe.rewardTargets).toContain("parts");
    expect(locked.action).toBe("locked");
    expect(locked.offline.killsPerHour).toBe(0);
    expect(locked.reasons).toContain("requiresBossGate");
    expect(dangerous.riskScore).toBeGreaterThan(safe.riskScore);
    expect(dangerous.reasons).toContain("anomaly");
    expect(dangerous.rewardTargets).toContain("bossFragment");
  });

  it("recommends separate offline and progression routes from projections", () => {
    const nodes = [
      { id: "farm", displayName: "Farm", description: "", arenaId: "arena_cinder_crucible" },
      { id: "duel", displayName: "Duel", description: "", arenaId: "arena_glass_mire_basin", unlocksRivalId: "rival_rim_warden" },
      { id: "locked", displayName: "Locked", description: "", arenaId: "arena_resonant_apex", requiredBossGateId: "boss_gate_brass_judicator" },
    ];
    const unlockedNodeIds = new Set(["farm", "duel"]);
    const strategyByNodeId = new Map(nodes.map((node) => [node.id, selectRouteStrategyProjection({ node, frameId: "frame_swift_razor", driveId: "drive_shard_barrage", unlockedNodeIds, clearedBossGateIds: [], clearedRivalIds: [] })]));

    const recommendations = selectRouteStrategyRecommendations({
      nodes,
      visibleNodeIds: new Set(nodes.map((node) => node.id)),
      unlockedNodeIds,
      strategyByNodeId,
    });

    expect(recommendations.offlineNodeId).toBe("farm");
    expect(recommendations.progressNodeId).toBe("duel");
  });

  it("projects build archetypes from drive tags, runes, and dps shape", () => {
    const projectileRunes = ["rune_splintered_edge", "rune_bloodless_line"];
    const projectileStats = resolveTopRuntimeStats("frame_swift_razor", "drive_shard_barrage", { runeIds: projectileRunes });
    const projectileDps = projectTopCombat({ arenaId: "arena_cinder_crucible", frameId: "frame_swift_razor", driveId: "drive_shard_barrage", loadout: { runeIds: projectileRunes } });
    const projectile = selectBuildArchetypeProjection({
      drive: getDriveCoreDef("drive_shard_barrage"),
      runes: projectileRunes.map(getTuningRuneDef),
      stats: projectileStats,
      dps: projectileDps,
    });

    const fireRunes = ["rune_red_heat", "rune_slow_burn"];
    const fireStats = resolveTopRuntimeStats("frame_ember_crucible", "drive_ember_scour", { runeIds: fireRunes });
    const fireDps = projectTopCombat({ arenaId: "arena_cinder_crucible", frameId: "frame_ember_crucible", driveId: "drive_ember_scour", loadout: { runeIds: fireRunes } });
    const fire = selectBuildArchetypeProjection({
      drive: getDriveCoreDef("drive_ember_scour"),
      runes: fireRunes.map(getTuningRuneDef),
      stats: fireStats,
      dps: fireDps,
    });

    expect(projectile.scores.find((score) => score.id === "projectileClear")?.score).toBeGreaterThan(projectile.scores.find((score) => score.id === "fireTrail")?.score ?? 0);
    expect(fire.scores.find((score) => score.id === "fireTrail")?.score).toBeGreaterThan(fire.scores.find((score) => score.id === "projectileClear")?.score ?? 0);
  });

  it("orders rune catalog by current build archetype", () => {
    const runeIds = ["rune_red_heat", "rune_slow_burn"];
    const stats = resolveTopRuntimeStats("frame_ember_crucible", "drive_ember_scour", { runeIds });
    const dps = projectTopCombat({ arenaId: "arena_cinder_crucible", frameId: "frame_ember_crucible", driveId: "drive_ember_scour", loadout: { runeIds } });
    const archetype = selectBuildArchetypeProjection({
      drive: getDriveCoreDef("drive_ember_scour"),
      runes: runeIds.map(getTuningRuneDef),
      stats,
      dps,
    });
    const ordered = selectRecommendedRunes([getTuningRuneDef("rune_splintered_edge"), getTuningRuneDef("rune_red_heat"), getTuningRuneDef("rune_slow_burn")], new Set(), true, {
      driveTags: getDriveCoreDef("drive_ember_scour").tags,
      buildArchetype: archetype,
    });

    expect(ordered.slice(0, 2).map((rune) => rune.id)).toEqual(["rune_red_heat", "rune_slow_burn"]);
  });
});
