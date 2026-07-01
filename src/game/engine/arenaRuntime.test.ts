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

  it("slides tops down the basin slope toward the center", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "basin_slope_test",
    });
    const onSlope = {
      ...runtime,
      nextEnemyIn: 10,
      enemies: [],
      player: {
        ...runtime.player,
        x: 210,
        y: 0,
        vx: 0,
        vy: 0,
        spinPower: 100,
        wobble: 0,
        cooldownRemaining: 10,
      },
    };

    const next = stepTopArenaRuntime(onSlope, 0.35);

    expect(next.player.x).toBeLessThan(185);
    expect(next.player.vx).toBeLessThan(-70);
    expect(Math.hypot(next.player.x, next.player.y)).toBeLessThan(Math.hypot(onSlope.player.x, onSlope.player.y));
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
    expect(next.effects.some((effect) => effect.kind === "bossSignal")).toBe(true);
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
      maxSpinIntegrity: 4200,
      maxFluxGuard: 500,
      guard: 480,
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

  it("resolves enemy-to-enemy collisions without dealing friendly damage", () => {
    const baseRuntime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_razor_rebound",
      seed: "enemy_enemy_collision_test",
    });
    const enemyStats = {
      ...baseRuntime.player.stats,
      maxSpinIntegrity: 2400,
      maxFluxGuard: 180,
      guard: 180,
      impact: 72,
      rpm: 6.8,
      mass: 1,
      grip: 0.42,
      edge: 0.05,
      fracture: 1.1,
      resonance: 0.75,
      partQuantity: 0,
      partRarity: 0,
      modifiers: [],
    };
    const leftEnemy = {
      ...baseRuntime.player,
      id: "left_collision_rival",
      team: "enemy" as const,
      name: "Left Collision Rival",
      rank: "pack" as const,
      x: 28,
      y: 32,
      vx: 118,
      vy: 0,
      radius: 22,
      spinIntegrity: enemyStats.maxSpinIntegrity,
      fluxGuard: enemyStats.maxFluxGuard,
      spinPower: 100,
      wobble: 0,
      cooldownRemaining: 10,
      stats: enemyStats,
      behaviorId: "hunter" as const,
    };
    const rightEnemy = {
      ...baseRuntime.player,
      id: "right_collision_rival",
      team: "enemy" as const,
      name: "Right Collision Rival",
      rank: "pack" as const,
      x: 64,
      y: 32,
      vx: -112,
      vy: 0,
      radius: 22,
      spinIntegrity: enemyStats.maxSpinIntegrity,
      fluxGuard: enemyStats.maxFluxGuard,
      spinPower: 100,
      wobble: 0,
      cooldownRemaining: 10,
      stats: enemyStats,
      behaviorId: "hunter" as const,
    };
    const withEnemyCollision = {
      ...baseRuntime,
      player: { ...baseRuntime.player, x: -230, y: -120, vx: 0, vy: 0, cooldownRemaining: 10 },
      enemies: [leftEnemy, rightEnemy],
      nextEnemyIn: 10,
    };

    const next = stepTopArenaRuntime(withEnemyCollision, 0.03, { collisionLaunchMultiplier: 1.65, sparkMultiplier: 1.3 });
    const nextLeft = next.enemies.find((enemy) => enemy.id === leftEnemy.id);
    const nextRight = next.enemies.find((enemy) => enemy.id === rightEnemy.id);
    const initialSeparation = Math.hypot(rightEnemy.x - leftEnemy.x, rightEnemy.y - leftEnemy.y);
    const nextSeparation = Math.hypot((nextRight?.x ?? 0) - (nextLeft?.x ?? 0), (nextRight?.y ?? 0) - (nextLeft?.y ?? 0));

    expect(next.lastCollision).toBeUndefined();
    expect(nextLeft?.spinIntegrity).toBe(enemyStats.maxSpinIntegrity);
    expect(nextRight?.spinIntegrity).toBe(enemyStats.maxSpinIntegrity);
    expect(nextSeparation).toBeGreaterThan(initialSeparation);
    expect(nextLeft?.vx ?? 0).toBeLessThan(leftEnemy.vx);
    expect(nextRight?.vx ?? 0).toBeGreaterThan(rightEnemy.vx);
    expect(nextLeft?.spinPower ?? 100).toBeLessThan(100);
    expect(nextRight?.spinPower ?? 100).toBeLessThan(100);
    expect(nextLeft?.wobble ?? 0).toBeGreaterThan(0);
    expect(nextRight?.wobble ?? 0).toBeGreaterThan(0);
    expect(next.effects.some((effect) => effect.kind === "frictionSpark")).toBe(true);
    expect(next.events.some((event) => event.text.includes("Razor Rebound hits"))).toBe(false);
  });

  it("launches tops farther from the basin center on high-speed impacts", () => {
    const baseRuntime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_razor_rebound",
      seed: "collision_launch_test",
    });
    const enemyStats = {
      ...baseRuntime.player.stats,
      maxSpinIntegrity: 12000,
      maxFluxGuard: 800,
      guard: 220,
      impact: 60,
      rpm: 6.2,
      mass: 1,
      grip: 0.44,
      edge: 0.05,
      fracture: 1,
      resonance: 0.8,
      partQuantity: 0,
      partRarity: 0,
      modifiers: [],
    };
    const makeImpactRuntime = (speed: number) => ({
      ...baseRuntime,
      player: { ...baseRuntime.player, x: -20, y: 0, vx: speed, vy: 0, cooldownRemaining: 10, spinPower: 100, wobble: 0 },
      enemies: [
        {
          ...baseRuntime.player,
          id: `launch_rival_${speed}`,
          team: "enemy" as const,
          name: "Launch Rival",
          rank: "pack" as const,
          x: 20,
          y: 0,
          vx: -speed,
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
      nextEnemyIn: 10,
    });

    const low = stepTopArenaRuntime(makeImpactRuntime(42), 0.05);
    const high = stepTopArenaRuntime(makeImpactRuntime(190), 0.05);
    const lowLaunchSpeed = Math.hypot(low.player.vx, low.player.vy);
    const highLaunchSpeed = Math.hypot(high.player.vx, high.player.vy);
    const lowSeparation = Math.hypot((low.enemies[0]?.x ?? 0) - low.player.x, (low.enemies[0]?.y ?? 0) - low.player.y);
    const highSeparation = Math.hypot((high.enemies[0]?.x ?? 0) - high.player.x, (high.enemies[0]?.y ?? 0) - high.player.y);

    expect(high.lastCollision?.normalImpulse ?? 0).toBeGreaterThan(low.lastCollision?.normalImpulse ?? 0);
    expect(highSeparation).toBeGreaterThan(lowSeparation + 5);
    expect(highLaunchSpeed).toBeGreaterThan(lowLaunchSpeed * 2.15);
    expect(Math.hypot(high.enemies[0]?.vx ?? 0, high.enemies[0]?.vy ?? 0)).toBeGreaterThan(Math.hypot(low.enemies[0]?.vx ?? 0, low.enemies[0]?.vy ?? 0) * 2.15);
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

  it("lets tuning raise active rival pressure without changing the map clear target", () => {
    const baseRuntime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "tuned_density_test",
    });
    const settle = (activeEnemyPressure: number) => {
      let next = baseRuntime;
      for (let index = 0; index < 24; index += 1) {
        next = stepTopArenaRuntime(next, 0.12, { activeEnemyPressure });
      }
      return next;
    };

    const lowPressure = settle(0.55);
    const highPressure = settle(1.65);

    expect(baseRuntime.mapKillTarget).toBeGreaterThanOrEqual(150);
    expect(baseRuntime.mapKillTarget).toBeLessThanOrEqual(200);
    expect(highPressure.enemies.length).toBeGreaterThan(lowPressure.enemies.length);
    expect(highPressure.enemies.length).toBeGreaterThanOrEqual(10);
  });

  it("lets tuning amplify basin pull and high-speed launch", () => {
    const slopeRuntime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "tuned_basin_pull_test",
    });
    const onSlope = {
      ...slopeRuntime,
      nextEnemyIn: 10,
      enemies: [],
      player: { ...slopeRuntime.player, x: 220, y: 0, vx: 0, vy: 0, spinPower: 100, wobble: 0, cooldownRemaining: 10 },
    };

    const softBasin = stepTopArenaRuntime(onSlope, 0.25, { basinPullMultiplier: 0.6 });
    const steepBasin = stepTopArenaRuntime(onSlope, 0.25, { basinPullMultiplier: 2.2 });

    expect(steepBasin.player.vx).toBeLessThan(softBasin.player.vx - 80);
    expect(Math.hypot(steepBasin.player.x, steepBasin.player.y)).toBeLessThan(Math.hypot(softBasin.player.x, softBasin.player.y) - 12);

    const impactRuntime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_razor_rebound",
      seed: "tuned_launch_test",
    });
    const enemyStats = {
      ...impactRuntime.player.stats,
      maxSpinIntegrity: 12000,
      maxFluxGuard: 800,
      guard: 220,
      impact: 60,
      rpm: 6.2,
      mass: 1,
      grip: 0.44,
      edge: 0.05,
      fracture: 1,
      resonance: 0.8,
      partQuantity: 0,
      partRarity: 0,
      modifiers: [],
    };
    const makeImpactRuntime = () => ({
      ...impactRuntime,
      player: { ...impactRuntime.player, x: -20, y: 0, vx: 170, vy: 0, cooldownRemaining: 10, spinPower: 100, wobble: 0 },
      enemies: [
        {
          ...impactRuntime.player,
          id: "tuned_launch_rival",
          team: "enemy" as const,
          name: "Tuned Launch Rival",
          rank: "pack" as const,
          x: 20,
          y: 0,
          vx: -170,
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
      nextEnemyIn: 10,
    });

    const lowLaunch = stepTopArenaRuntime(makeImpactRuntime(), 0.05, { collisionLaunchMultiplier: 0.65, sparkMultiplier: 0.6 });
    const highLaunch = stepTopArenaRuntime(makeImpactRuntime(), 0.05, { collisionLaunchMultiplier: 2.2, sparkMultiplier: 1.8 });

    expect(Math.hypot(highLaunch.player.vx, highLaunch.player.vy)).toBeGreaterThan(Math.hypot(lowLaunch.player.vx, lowLaunch.player.vy) * 1.35);
    expect(highLaunch.lastCollision?.sparkIntensity ?? 0).toBeGreaterThan(lowLaunch.lastCollision?.sparkIntensity ?? 0);
    expect(highLaunch.effects.some((effect) => effect.kind === "shockwave")).toBe(true);
  });

  it("signals the final boss once the 150-200 rival clear is complete", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_red_chancel_disk",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "boss_signal_test",
    });
    const defeatedRival = {
      ...runtime.player,
      id: "last_pack_before_boss",
      team: "enemy" as const,
      name: "Last Cinder Runner",
      rank: "pack" as const,
      x: 48,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 20,
      spinIntegrity: 0,
      cooldownRemaining: 10,
      behaviorId: "hunter" as const,
    };

    const cleared = stepTopArenaRuntime(
      {
        ...runtime,
        mapKills: runtime.mapKillTarget - 1,
        enemies: [defeatedRival],
        nextEnemyIn: 10,
      },
      0.05,
    );
    const bossSpawn = stepTopArenaRuntime({ ...cleared, enemies: [], nextEnemyIn: 0 }, 0.05);

    expect(cleared.mapKills).toBe(cleared.mapKillTarget);
    expect(cleared.effects.some((effect) => effect.kind === "bossSignal")).toBe(true);
    expect(cleared.events.some((event) => event.text.includes("Brass Judicator is entering"))).toBe(true);
    expect(bossSpawn.enemies).toHaveLength(1);
    expect(bossSpawn.enemies[0]?.rank).toBe("boss");
    expect(bossSpawn.effects.some((effect) => effect.kind === "bossSignal")).toBe(true);
  });
});
