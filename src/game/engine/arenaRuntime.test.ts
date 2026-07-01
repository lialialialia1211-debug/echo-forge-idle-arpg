import { describe, expect, it } from "vitest";
import { createTopArenaRuntime, stepTopArenaRuntime } from "./arenaRuntime";

describe("top arena runtime", () => {
  it("spawns enemies automatically when the arena starts", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "spawn_test",
    });

    const next = stepTopArenaRuntime(runtime, 0.25);

    expect(next.enemies).toHaveLength(1);
    expect(next.mapKillTarget).toBeGreaterThanOrEqual(150);
    expect(next.mapKillTarget).toBeLessThanOrEqual(200);
    expect(next.events.some((event) => event.text.includes("enters the basin"))).toBe(true);
  });

  it("fills the basin with multiple small enemies before the boss", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "basin_density_test",
    });

    let next = runtime;
    for (let index = 0; index < 8; index += 1) {
      next = stepTopArenaRuntime(next, 0.25);
    }

    expect(next.enemies.length).toBeGreaterThan(1);
    expect(next.enemies.every((enemy) => enemy.rank !== "boss")).toBe(true);
    expect(next.mapKills).toBeLessThan(next.mapKillTarget);
  });

  it("uses drive visuals for automatic skill effects", () => {
    const stormRuntime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_storm_needle",
      driveId: "drive_storm_lattice",
      seed: "storm_test",
    });
    const emberRuntime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_ember_crucible",
      driveId: "drive_ember_scour",
      seed: "ember_test",
    });

    const stormNext = stepTopArenaRuntime(stormRuntime, 0.25);
    const emberNext = stepTopArenaRuntime(emberRuntime, 0.25);

    expect(stormNext.effects.some((effect) => effect.kind === "stormArc")).toBe(true);
    expect(emberNext.effects.some((effect) => effect.kind === "emberTrail")).toBe(true);
    expect(stormNext.events.some((event) => event.tone === "skill")).toBe(true);
    expect(emberNext.events.some((event) => event.tone === "skill")).toBe(true);
  });

  it("starts routes with an arena event and spawns modified enemies", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_red_chancel_disk",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "modifier_event_test",
    });

    const next = stepTopArenaRuntime(runtime, 0.25);

    expect(runtime.activeEvent?.displayName).toBeTruthy();
    expect(runtime.events.some((event) => event.text.includes(runtime.activeEvent?.displayName ?? ""))).toBe(true);
    expect(next.enemies[0]?.enemyModifier?.displayName).toBeTruthy();
    expect(next.enemies[0]?.name).toContain(next.enemies[0]?.enemyModifier?.displayName);
    expect(next.enemies[0]?.behaviorId).toBeTruthy();
  });

  it("runs enemy behavior skills for chargers, mine layers, and bosses", () => {
    const baseRuntime = createTopArenaRuntime({
      arenaId: "arena_red_chancel_disk",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "enemy_behavior_test",
    });

    const withEnemies = {
      ...baseRuntime,
      enemies: [
        {
          ...baseRuntime.player,
          id: "test_charger",
          team: "enemy" as const,
          name: "Redline Rival",
          rank: "pack" as const,
          x: 180,
          y: 0,
          vx: 0,
          vy: 0,
          radius: 22,
          cooldownRemaining: 0,
          behaviorId: "charger" as const,
        },
        {
          ...baseRuntime.player,
          id: "test_mine_layer",
          team: "enemy" as const,
          name: "Furnace Rival",
          rank: "pack" as const,
          x: -120,
          y: 0,
          vx: 0,
          vy: 0,
          radius: 22,
          cooldownRemaining: 0,
          behaviorId: "mineLayer" as const,
        },
        {
          ...baseRuntime.player,
          id: "test_boss",
          team: "enemy" as const,
          name: "Brass Judicator",
          rank: "boss" as const,
          x: 0,
          y: 150,
          vx: 0,
          vy: 0,
          radius: 34,
          cooldownRemaining: 0,
          behaviorId: "bossJudicator" as const,
        },
      ],
      nextEnemyIn: 10,
    };

    const next = stepTopArenaRuntime(withEnemies, 0.05);

    expect(next.effects.some((effect) => effect.kind === "chargeLine")).toBe(true);
    expect(next.effects.some((effect) => effect.kind === "hazard")).toBe(true);
    expect(next.effects.some((effect) => effect.kind === "shockwave")).toBe(true);
    expect(next.events.some((event) => event.text.includes("charge"))).toBe(true);
    expect(next.events.some((event) => event.text.includes("furnace groove"))).toBe(true);
    expect(next.events.some((event) => event.text.includes("Judicator shockwave"))).toBe(true);
  });

  it("spawns one boss after the map clear target and does not fire boss skills on the spawn frame", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_red_chancel_disk",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "boss_spawn_windup_test",
    });

    const next = stepTopArenaRuntime({ ...runtime, mapKills: runtime.mapKillTarget, enemies: [], nextEnemyIn: 0 }, 0.05);

    expect(next.enemies[0]?.rank).toBe("boss");
    expect(next.enemies).toHaveLength(1);
    expect(next.bossSpawned).toBe(true);
    expect(next.enemies[0]?.cooldownRemaining).toBeGreaterThan(0.8);
    expect(next.effects.some((effect) => effect.kind === "shockwave")).toBe(false);
    expect(next.events.some((event) => event.text.includes("Judicator shockwave"))).toBe(false);
  });

  it("pulls tops toward the low center of the basin", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "basin_pull_test",
    });

    const next = stepTopArenaRuntime(
      {
        ...runtime,
        player: { ...runtime.player, x: 210, y: 0, vx: 0, vy: 0 },
        enemies: [],
        nextEnemyIn: 10,
      },
      0.25,
    );

    expect(next.player.x).toBeLessThan(210);
    expect(next.player.vx).toBeLessThan(0);
  });

  it("arms enemy hazards before they can damage the player", () => {
    const baseRuntime = createTopArenaRuntime({
      arenaId: "arena_red_chancel_disk",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "hazard_arm_test",
    });
    const withMineLayer = {
      ...baseRuntime,
      player: { ...baseRuntime.player, x: 0, y: 0, vx: 0, vy: 0 },
      enemies: [
        {
          ...baseRuntime.player,
          id: "test_mine_layer",
          team: "enemy" as const,
          name: "Furnace Rival",
          rank: "pack" as const,
          x: -120,
          y: 0,
          vx: 0,
          vy: 0,
          radius: 22,
          cooldownRemaining: 0,
          behaviorId: "mineLayer" as const,
        },
      ],
      nextEnemyIn: 10,
    };

    const next = stepTopArenaRuntime(withMineLayer, 0.05);

    expect(next.effects.some((effect) => effect.kind === "hazard")).toBe(true);
    expect(next.player.spinIntegrity).toBe(baseRuntime.player.stats.maxSpinIntegrity);
  });

  it("records physical top collisions and feeds collision drives", () => {
    const baseRuntime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_razor_rebound",
      seed: "collision_physics_test",
    });
    const enemyStats = {
      ...baseRuntime.player.stats,
      maxSpinIntegrity: 620,
      maxFluxGuard: 80,
      guard: 110,
      impact: 92,
      rpm: 5.4,
      mass: 1.1,
      grip: 0.46,
      edge: 0.05,
      fracture: 1.2,
      resonance: 0.82,
      partQuantity: 0,
      partRarity: 0,
      modifiers: [],
    };
    const withCollision = {
      ...baseRuntime,
      player: { ...baseRuntime.player, x: 0, y: 0, vx: 92, vy: 8, cooldownRemaining: 0, spinPower: 100, wobble: 0 },
      enemies: [
        {
          ...baseRuntime.player,
          id: "collision_rival",
          team: "enemy" as const,
          name: "Collision Rival",
          rank: "pack" as const,
          x: 44,
          y: 0,
          vx: -86,
          vy: -12,
          radius: 22,
          spinIntegrity: enemyStats.maxSpinIntegrity,
          fluxGuard: enemyStats.maxFluxGuard,
          spinPower: 100,
          wobble: 0,
          cooldownRemaining: 10,
          stats: enemyStats,
          behaviorId: "hunter" as const,
        },
      ],
      nextEnemyIn: 10,
    };

    const next = stepTopArenaRuntime(withCollision, 0.05);

    expect(next.lastCollision?.normalImpulse).toBeGreaterThan(0);
    expect(Math.abs(next.lastCollision?.tangentImpulse ?? 0)).toBeGreaterThan(0);
    expect(next.lastCollision?.surfaceShear).toBeGreaterThan(0);
    expect(next.lastCollision?.sparkIntensity).toBeGreaterThan(0.55);
    expect(["scrape", "clash", "smash", "grind"]).toContain(next.lastCollision?.kind);
    expect(next.lastCollision?.contactAge).toBeCloseTo(0.05, 5);
    expect(next.collisionContacts.collision_rival).toBeCloseTo(0.05, 5);
    expect(next.effects.some((effect) => effect.kind === "frictionSpark")).toBe(true);
    expect(next.player.spinPower).toBeLessThan(100);
    expect(next.player.wobble).toBeGreaterThan(0);
    expect(next.enemies[0]?.spinPower).toBeLessThan(100);
    expect(next.events.some((event) => event.text.includes("Razor Rebound hits"))).toBe(true);
    expect(next.player.cooldownRemaining).toBeGreaterThan(0);
  });

  it("scales friction sparks with spin speed", () => {
    const baseRuntime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_razor_rebound",
      seed: "spin_scaled_friction_test",
    });
    const makeCollisionRuntime = (rpm: number) => ({
      ...baseRuntime,
      player: {
        ...baseRuntime.player,
        stats: { ...baseRuntime.player.stats, rpm },
        x: 0,
        y: 0,
        vx: 88,
        vy: 14,
        cooldownRemaining: 10,
        spinPower: 100,
        wobble: 0,
      },
      enemies: [
        {
          ...baseRuntime.player,
          id: `spin_rival_${rpm}`,
          team: "enemy" as const,
          name: "Spin Rival",
          rank: "pack" as const,
          stats: { ...baseRuntime.player.stats, rpm, maxSpinIntegrity: 800, maxFluxGuard: 80, mass: 1, grip: 0.42, edge: 0.05, modifiers: [] },
          x: 44,
          y: 0,
          vx: -82,
          vy: -16,
          radius: 22,
          spinIntegrity: 800,
          fluxGuard: 80,
          spinPower: 100,
          wobble: 0,
          cooldownRemaining: 10,
          behaviorId: "hunter" as const,
        },
      ],
      nextEnemyIn: 10,
    });

    const low = stepTopArenaRuntime(makeCollisionRuntime(2.2), 0.05);
    const high = stepTopArenaRuntime(makeCollisionRuntime(9.4), 0.05);

    expect(high.lastCollision?.surfaceShear ?? 0).toBeGreaterThan(low.lastCollision?.surfaceShear ?? 0);
    expect(high.lastCollision?.sparkIntensity ?? 0).toBeGreaterThan(low.lastCollision?.sparkIntensity ?? 0);
    expect(high.player.spinPower).toBeLessThan(low.player.spinPower);
  });

  it("turns sustained high-shear contact into grind and feeds molten groove", () => {
    const baseRuntime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_ember_crucible",
      driveId: "drive_molten_groove",
      seed: "grind_collision_skill_test",
    });
    const enemyStats = {
      ...baseRuntime.player.stats,
      maxSpinIntegrity: 780,
      maxFluxGuard: 80,
      guard: 130,
      impact: 78,
      rpm: 8.8,
      mass: 1.05,
      grip: 0.5,
      edge: 0.04,
      fracture: 1.2,
      resonance: 0.9,
      partQuantity: 0,
      partRarity: 0,
      modifiers: [],
    };
    const withGrind = {
      ...baseRuntime,
      player: { ...baseRuntime.player, x: 0, y: 0, vx: 18, vy: 0, cooldownRemaining: 0, spinPower: 100, wobble: 0, stats: { ...baseRuntime.player.stats, rpm: 9.2 } },
      enemies: [
        {
          ...baseRuntime.player,
          id: "grind_rival",
          team: "enemy" as const,
          name: "Grind Rival",
          rank: "pack" as const,
          x: 44,
          y: 0,
          vx: -12,
          vy: 0,
          radius: 22,
          spinIntegrity: enemyStats.maxSpinIntegrity,
          fluxGuard: enemyStats.maxFluxGuard,
          spinPower: 100,
          wobble: 0,
          cooldownRemaining: 10,
          stats: enemyStats,
          behaviorId: "hunter" as const,
        },
      ],
      collisionContacts: { grind_rival: 0.2 },
      nextEnemyIn: 10,
    };

    const next = stepTopArenaRuntime(withGrind, 0.05);

    expect(next.lastCollision?.kind).toBe("grind");
    expect(next.lastCollision?.contactAge).toBeCloseTo(0.25, 5);
    expect(next.effects.some((effect) => effect.kind === "hazard")).toBe(true);
    expect(next.events.some((event) => event.text.includes("Molten Groove hits"))).toBe(true);
  });
});
