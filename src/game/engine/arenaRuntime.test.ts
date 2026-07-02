import { describe, expect, it } from "vitest";
import { createCollisionDamage, createTopArenaRuntime, stepTopArenaRuntime } from "./arenaRuntime";
import { createCollisionPacket } from "./topCombat";
import { generateTopPart } from "./topPartGeneration";

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

  it("keeps opening spin energy readable during early combat", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "opening_sustain_test",
    });

    let next = runtime;
    for (let index = 0; index < 120; index += 1) {
      next = stepTopArenaRuntime(next, 0.05);
    }

    const energyRatio = (next.player.spinEnergy ?? 0) / Math.max(1, next.player.maxSpinEnergy ?? next.player.stats.maxSpinIntegrity);

    expect(next.kills).toBeGreaterThan(0);
    expect(energyRatio).toBeGreaterThan(0.12);
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
      player: { ...baseRuntime.player, stats: { ...baseRuntime.player.stats, mass: 1.3 }, x: 0, y: 0, vx: 92, vy: 8, cooldownRemaining: 0, spinPower: 100, wobble: 0 },
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

  it("charges and stabilizes the Breach Rail route mechanic from kills", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      loadout: { circuitAtlasNodeIds: ["atlas_breach_calibrator", "atlas_dense_rail"] },
      seed: "breach_rail_test",
    });
    const defeatedElite = {
      ...runtime.player,
      id: "breach_elite",
      team: "enemy" as const,
      name: "Breach Elite",
      rank: "elite" as const,
      x: 40,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 24,
      spinIntegrity: 0,
      cooldownRemaining: 10,
      behaviorId: "hunter" as const,
    };

    const charged = stepTopArenaRuntime({ ...runtime, routeMechanic: { ...runtime.routeMechanic!, progress: 94 }, enemies: [defeatedElite], nextEnemyIn: 10 }, 0.05);

    expect(charged.routeMechanic?.stabilized).toBe(true);
    expect(charged.routeMechanic?.active).toBe(false);
    expect(charged.routeMechanic?.rewardQuantity).toBeGreaterThan(runtime.routeMechanic?.rewardQuantity ?? 0);
    expect(charged.events.some((event) => event.text.includes("Breach Rail stabilized"))).toBe(true);
  });

  it("turns projectile-count runes into extra skill targets", () => {
    const makeRuntime = (runeIds: string[]) => {
      const runtime = createTopArenaRuntime({
        arenaId: "arena_cinder_crucible",
        frameId: "frame_swift_razor",
        driveId: "drive_shard_barrage",
        loadout: { runeIds },
        seed: `projectile_rune_${runeIds.join("_") || "none"}`,
      });
      const enemyStats = {
        ...runtime.player.stats,
        maxSpinIntegrity: 900,
        maxFluxGuard: 80,
        guard: 80,
        impact: 60,
        rpm: 5,
        mass: 1,
        grip: 0.4,
        edge: 0.04,
        fracture: 1.1,
        resonance: 0.8,
        partQuantity: 0,
        partRarity: 0,
        modifiers: [],
      };
      return {
        ...runtime,
        player: { ...runtime.player, cooldownRemaining: 0 },
        enemies: [0, 1, 2].map((index) => ({
          ...runtime.player,
          id: `projectile_target_${index}`,
          team: "enemy" as const,
          name: `Projectile Target ${index}`,
          rank: "pack" as const,
          x: 64 + index * 32,
          y: index * 18,
          vx: 0,
          vy: 0,
          radius: 22,
          spinIntegrity: enemyStats.maxSpinIntegrity,
          fluxGuard: enemyStats.maxFluxGuard,
          spinPower: 100,
          wobble: 0,
          cooldownRemaining: 10,
          stats: enemyStats,
          behaviorId: "hunter" as const,
        })),
        nextEnemyIn: 10,
      };
    };

    const withoutRune = stepTopArenaRuntime(makeRuntime([]), 0.05);
    const withRune = stepTopArenaRuntime(makeRuntime(["rune_splintered_edge"]), 0.05);

    expect(withoutRune.enemies.filter((enemy) => enemy.spinIntegrity < 900)).toHaveLength(1);
    expect(withRune.enemies.filter((enemy) => enemy.spinIntegrity < 900).length).toBeGreaterThan(1);
  });

  it("uses boss phase three pressure at low integrity", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_red_chancel_disk",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "boss_phase_three_test",
    });
    const boss = {
      ...runtime.player,
      id: "phase_three_boss",
      team: "enemy" as const,
      name: "Phase Three Judicator",
      rank: "boss" as const,
      x: 0,
      y: 120,
      vx: 0,
      vy: 0,
      radius: 38,
      spinIntegrity: runtime.player.stats.maxSpinIntegrity * 0.24,
      cooldownRemaining: 0,
      behaviorId: "bossJudicator" as const,
      bossPhase: 3 as const,
    };

    const next = stepTopArenaRuntime({ ...runtime, player: { ...runtime.player, x: 0, y: 0 }, enemies: [boss], bossSpawned: true, mapKills: runtime.mapKillTarget, nextEnemyIn: 10 }, 0.05);

    expect(next.effects.some((effect) => effect.kind === "chargeLine")).toBe(true);
    expect(next.events.some((event) => event.text.includes("phase 3"))).toBe(true);
    expect(next.player.spinIntegrity).toBeLessThan(runtime.player.stats.maxSpinIntegrity);
  });

  it("gates boss integrity so burst damage cannot skip all three phases", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_red_chancel_disk",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "boss_phase_gate_test",
    });
    const bossStats = {
      ...runtime.player.stats,
      maxSpinIntegrity: 12000,
      maxFluxGuard: 800,
      guard: 50,
      drift: 10,
      impact: 120,
      rpm: 4.4,
      mass: 1.8,
      grip: 0.7,
      edge: 0.08,
      fracture: 1.4,
      resonance: 0.8,
      partQuantity: 0,
      partRarity: 0,
      modifiers: [],
    };
    const boss = {
      ...runtime.player,
      id: "gated_boss",
      team: "enemy" as const,
      name: "Gated Judicator",
      rank: "boss" as const,
      x: 70,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 38,
      spinIntegrity: bossStats.maxSpinIntegrity,
      fluxGuard: bossStats.maxFluxGuard,
      cooldownRemaining: 10,
      stats: bossStats,
      behaviorId: "bossJudicator" as const,
      bossPhase: 1 as const,
      phaseGateCooldown: 0,
    };
    const burstRuntime = {
      ...runtime,
      player: {
        ...runtime.player,
        cooldownRemaining: 0,
        stats: {
          ...runtime.player.stats,
          impact: 250000,
          tracking: 250000,
          edge: 0.6,
          fracture: 2.2,
        },
      },
      enemies: [boss],
      bossSpawned: true,
      mapKills: runtime.mapKillTarget,
      nextEnemyIn: 10,
    };

    const next = stepTopArenaRuntime(burstRuntime, 0.05);
    const nextBoss = next.enemies.find((enemy) => enemy.rank === "boss");

    expect(nextBoss?.spinIntegrity).toBeCloseTo(bossStats.maxSpinIntegrity * 0.66, 1);
    expect(nextBoss?.bossPhase).toBe(2);
    expect(nextBoss?.phaseGateCooldown ?? 0).toBeGreaterThan(1);
    expect(next.events.some((event) => event.text.includes("enters phase 2"))).toBe(true);
  });

  it("does not spawn new map rivals while the boss is still alive", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_red_chancel_disk",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "boss_no_next_map_spawn_test",
    });
    const boss = {
      ...runtime.player,
      id: "alive_boss",
      team: "enemy" as const,
      name: "Alive Judicator",
      rank: "boss" as const,
      x: 120,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 38,
      spinIntegrity: runtime.player.stats.maxSpinIntegrity * 0.5,
      cooldownRemaining: 10,
      behaviorId: "bossJudicator" as const,
      bossPhase: 2 as const,
      phaseGateCooldown: 0,
    };

    const next = stepTopArenaRuntime(
      {
        ...runtime,
        enemies: [boss],
        bossSpawned: true,
        mapKills: runtime.mapKillTarget,
        nextEnemyIn: 0,
        routeTransitionCooldown: 0,
      },
      0.05,
    );

    expect(next.enemies.filter((enemy) => enemy.rank === "boss")).toHaveLength(1);
    expect(next.enemies.filter((enemy) => enemy.rank !== "boss")).toHaveLength(0);
  });

  it("uses a route transition cooldown after the boss dies before spawning the next map", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_red_chancel_disk",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "route_transition_cooldown_test",
    });
    const defeatedBoss = {
      ...runtime.player,
      id: "defeated_boss",
      team: "enemy" as const,
      name: "Defeated Judicator",
      rank: "boss" as const,
      x: 90,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 38,
      spinIntegrity: 0,
      cooldownRemaining: 10,
      behaviorId: "bossJudicator" as const,
      bossPhase: 3 as const,
    };

    const cleared = stepTopArenaRuntime(
      {
        ...runtime,
        enemies: [defeatedBoss],
        bossSpawned: true,
        mapKills: runtime.mapKillTarget,
        nextEnemyIn: 10,
      },
      0.05,
    );
    const waiting = stepTopArenaRuntime({ ...cleared, nextEnemyIn: 0 }, 0.05);

    expect(cleared.routeClears).toBe(1);
    expect(cleared.routeTransitionCooldown).toBeGreaterThan(4);
    expect(cleared.events.some((event) => event.text.includes("Next route spooling"))).toBe(true);
    expect(waiting.enemies).toHaveLength(0);
    expect(waiting.mapKills).toBe(0);
    expect(waiting.bossSpawned).toBe(false);
  });

  it("lets Storm Orbit unique parts light up enemy crowd collisions", () => {
    const stormOrbit = generateTopPart({
      id: "test_storm_orbit",
      baseId: "part_ring_storm_orbit",
      rarity: "relic",
      itemLevel: 12,
      seed: "test_storm_orbit",
      arenaId: "test",
      enemyLevel: 12,
      source: "debug",
    });
    const runtime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      loadout: { equipment: { attackRing: stormOrbit } },
      seed: "storm_orbit_unique_test",
    });
    const enemyStats = {
      ...runtime.player.stats,
      maxSpinIntegrity: 1600,
      maxFluxGuard: 100,
      guard: 100,
      impact: 70,
      rpm: 6.6,
      mass: 1,
      grip: 0.4,
      edge: 0.04,
      fracture: 1.1,
      resonance: 0.8,
      partQuantity: 0,
      partRarity: 0,
      modifiers: [],
    };
    const next = stepTopArenaRuntime(
      {
        ...runtime,
        player: { ...runtime.player, x: -240, y: -120, cooldownRemaining: 10 },
        enemies: [
          {
            ...runtime.player,
            id: "storm_left",
            team: "enemy" as const,
            name: "Storm Left",
            rank: "pack" as const,
            x: 24,
            y: 10,
            vx: 120,
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
          {
            ...runtime.player,
            id: "storm_right",
            team: "enemy" as const,
            name: "Storm Right",
            rank: "pack" as const,
            x: 58,
            y: 10,
            vx: -120,
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
      },
      0.03,
    );

    expect(next.effects.some((effect) => effect.kind === "stormArc")).toBe(true);
  });

  it("does not restore spin energy unless Flux can sustain it", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "flux_energy_sustain_test",
    });
    const lowEnergyPlayer = {
      ...runtime.player,
      spinEnergy: 120,
      spinPower: (120 / Math.max(1, runtime.player.maxSpinEnergy ?? runtime.player.stats.maxSpinIntegrity)) * 100,
      cooldownRemaining: 10,
    };

    const noFlux = stepTopArenaRuntime(
      {
        ...runtime,
        player: { ...lowEnergyPlayer, stats: { ...lowEnergyPlayer.stats, mass: 1.3 }, flux: 0 },
        enemies: [],
        nextEnemyIn: 10,
      },
      0.01,
    );
    const withFlux = stepTopArenaRuntime(
      {
        ...runtime,
        player: { ...lowEnergyPlayer, flux: 100 },
        enemies: [],
        nextEnemyIn: 10,
      },
      0.5,
    );
    const fullEnergy = stepTopArenaRuntime(
      {
        ...runtime,
        player: { ...runtime.player, flux: 100, cooldownRemaining: 10 },
        enemies: [],
        nextEnemyIn: 10,
      },
      0.5,
    );

    expect(noFlux.player.spinEnergy ?? 0).toBeLessThan(120);
    expect(withFlux.player.spinEnergy ?? 0).toBeGreaterThan(120);
    expect(withFlux.player.flux ?? 0).toBeLessThan(fullEnergy.player.flux ?? 0);
  });

  it("shatters enemies when their spin energy reaches zero", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "zero_energy_kill_test",
    });
    const exhaustedEnemy = {
      ...runtime.player,
      id: "exhausted_enemy",
      team: "enemy" as const,
      name: "Exhausted Rival",
      rank: "pack" as const,
      spinIntegrity: 500,
      spinEnergy: 0,
      spinPower: 0,
      stats: { ...runtime.player.stats, maxSpinIntegrity: 500, modifiers: [] },
      cooldownRemaining: 10,
      behaviorId: "hunter" as const,
    };

    const next = stepTopArenaRuntime(
      {
        ...runtime,
        enemies: [exhaustedEnemy],
        nextEnemyIn: 10,
      },
      0.01,
    );

    expect(next.enemies).toHaveLength(0);
    expect(next.kills).toBe(1);
  });

  it("uses D=M collision damage in real hits and keeps it independent from rpm and impact speed", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "dm_collision_damage_test",
    });
    const defender = {
      ...runtime.player,
      id: "dm_defender",
      team: "enemy" as const,
      rank: "pack" as const,
      stats: { ...runtime.player.stats, modifiers: [] },
    };
    const collision = {
      kind: "clash" as const,
      normalImpulse: 80,
      tangentImpulse: 20,
      relativeNormalSpeed: 120,
      relativeTangentialSpeed: 40,
      surfaceShear: 90,
      sparkIntensity: 1,
      contactAge: 0.02,
      heavy: false,
    };
    const lowMass = {
      ...runtime.player,
      stats: { ...runtime.player.stats, mass: 0.9, rpm: 2.2, impact: 40, modifiers: [] },
      vx: 40,
      vy: 0,
    };
    const lowMassFast = {
      ...lowMass,
      stats: { ...lowMass.stats, rpm: 9.4, impact: 200 },
      vx: 260,
      vy: -180,
    };
    const highMass = {
      ...lowMass,
      stats: { ...lowMass.stats, mass: 1.35 },
    };

    const lowDamage = createCollisionDamage(lowMass, defender, collision).impact;
    const lowFastDamage = createCollisionDamage(lowMassFast, defender, { ...collision, normalImpulse: 260, tangentImpulse: 140 }).impact;
    const highDamage = createCollisionDamage(highMass, defender, collision).impact;
    const projected = createCollisionPacket(lowMass.stats).impact;

    expect(lowDamage).toBeCloseTo(projected, 5);
    expect(lowFastDamage).toBeCloseTo(lowDamage, 5);
    expect(highDamage).toBeGreaterThan(lowDamage * 1.4);
  });

  it("emits collision and discharge events only when a gated Drive is physically unlocked", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_razor_rebound",
      seed: "drive_gate_event_test",
    });
    const makeEnemy = () => ({
      ...runtime.player,
      id: "gate_target",
      team: "enemy" as const,
      name: "Gate Target",
      rank: "pack" as const,
      x: 42,
      y: 0,
      vx: -40,
      vy: 0,
      radius: 22,
      spinIntegrity: 1200,
      fluxGuard: 80,
      spinPower: 100,
      wobble: 0,
      cooldownRemaining: 10,
      stats: { ...runtime.player.stats, maxSpinIntegrity: 1200, maxFluxGuard: 80, guard: 50, mass: 1, modifiers: [] },
      behaviorId: "hunter" as const,
    });
    const makeRuntime = (mass: number) => ({
      ...runtime,
      player: {
        ...runtime.player,
        stats: { ...runtime.player.stats, mass },
        x: 0,
        y: 0,
        vx: 40,
        vy: 0,
        flux: 100,
        cooldownRemaining: 0,
      },
      enemies: [makeEnemy()],
      nextEnemyIn: 10,
    });

    const locked = stepTopArenaRuntime(makeRuntime(1), 0.03);
    const unlocked = stepTopArenaRuntime(makeRuntime(1.3), 0.03);

    expect(locked.combatEvents.some((event) => event.kind === "clash" || event.kind === "smash" || event.kind === "scrape" || event.kind === "grind")).toBe(true);
    expect(locked.combatEvents.some((event) => event.kind === "discharge")).toBe(false);
    expect(unlocked.combatEvents.some((event) => event.kind === "discharge" && event.driveId === "drive_razor_rebound")).toBe(true);
  });

  it("emits overheat when a ready skill wants to fire with empty Flux", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "overheat_event_test",
    });
    const enemy = {
      ...runtime.player,
      id: "overheat_target",
      team: "enemy" as const,
      name: "Overheat Target",
      rank: "pack" as const,
      x: 80,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 22,
      spinIntegrity: 800,
      fluxGuard: 80,
      cooldownRemaining: 10,
      stats: { ...runtime.player.stats, maxSpinIntegrity: 800, maxFluxGuard: 80, modifiers: [] },
      behaviorId: "hunter" as const,
    };

    const next = stepTopArenaRuntime(
      {
        ...runtime,
        player: { ...runtime.player, flux: 0, cooldownRemaining: 0 },
        enemies: [enemy],
        nextEnemyIn: 10,
      },
      0,
    );

    expect(next.combatEvents.some((event) => event.kind === "overheat" && event.driveId === "drive_shard_barrage")).toBe(true);
  });
});
