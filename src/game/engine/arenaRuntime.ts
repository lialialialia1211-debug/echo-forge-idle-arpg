import { getArenaCircuitDef } from "../data/arenaCircuits";
import { arenaEvents } from "../data/arenaEvents";
import { balanceConfig } from "../data/balanceConfig";
import { resolveCircuitAtlasBonuses } from "../data/circuitAtlasNodes";
import { getDriveCoreDef } from "../data/driveCores";
import { enemyModifiers } from "../data/enemyModifiers";
import { getTopFrameDef } from "../data/topFrames";
import { getTuningRuneDef } from "../data/tuningRunes";
import { summarizeArenaKeyRiskReward } from "./arenaKeys";
import { validateRuneLoadout } from "./driveRuneValidation";
import { clamp } from "./math";
import { resolveStatsPhysics } from "./topPhysics";
import { createRng } from "./rng";
import { resolveTopRuntimeStats } from "./topAssembly";
import { resolveTopHit } from "./topDamage";
import type {
  ArenaDrop,
  ArenaEffect,
  ArenaEventState,
  ArenaKey,
  ArenaLogEvent,
  ArenaTuningConfig,
  ArenaRewardBias,
  EnemyBehaviorId,
  EnemyModifierDef,
  TopArenaRuntime,
  TopCollisionEvent,
  TopLoadoutConfig,
  TopPartSlotId,
  TopRuntimeEntity,
  TopRuntimeStats,
  TuningRuneDef,
} from "./topTypes";
import { emptyDamagePacket, zeroResistances } from "./topTypes";

const maxEvents = 8;
const maxEffects = 80;
const maxDrops = 12;
const minMapKillTarget = 150;
const maxMapKillTarget = 200;
const maxActiveSmallEnemies = 20;
const bossPhaseTwoGateRatio = 0.66;
const bossPhaseThreeGateRatio = 0.33;
const bossPhaseGateCooldownSeconds = 1.35;
const routeTransitionCooldownSeconds = 4.5;

type ActiveRuneBehaviors = Partial<Record<NonNullable<TuningRuneDef["behavior"]>, number>>;

export const defaultArenaTuning: ArenaTuningConfig = {
  basinPullMultiplier: 1.38,
  collisionLaunchMultiplier: 1.35,
  sparkMultiplier: 1.16,
  activeEnemyPressure: 1,
  bossWeightMultiplier: 1,
  hitStopMultiplier: 1,
};

function activeRuneIds(runtime: Pick<TopArenaRuntime, "driveId" | "loadout">): string[] {
  return validateRuneLoadout(runtime.driveId, runtime.loadout.runeIds ?? []).validRuneIds;
}

function activeRuneBehaviors(runtime: Pick<TopArenaRuntime, "driveId" | "loadout">): ActiveRuneBehaviors {
  return activeRuneIds(runtime).reduce<ActiveRuneBehaviors>((behaviors, runeId) => {
    const behavior = getTuningRuneDef(runeId).behavior;
    if (!behavior) {
      return behaviors;
    }
    behaviors[behavior] = (behaviors[behavior] ?? 0) + 1;
    return behaviors;
  }, {});
}

function behaviorCount(behaviors: ActiveRuneBehaviors, behavior: NonNullable<TuningRuneDef["behavior"]>): number {
  return behaviors[behavior] ?? 0;
}

function hasEquippedBase(runtime: Pick<TopArenaRuntime, "loadout">, baseId: string): boolean {
  return Object.values(runtime.loadout.equipment ?? {}).some((part) => part?.baseId === baseId);
}

function normalizeArenaTuning(tuning?: Partial<ArenaTuningConfig>): ArenaTuningConfig {
  return {
    basinPullMultiplier: clamp(tuning?.basinPullMultiplier ?? defaultArenaTuning.basinPullMultiplier, 0.4, 2.8),
    collisionLaunchMultiplier: clamp(tuning?.collisionLaunchMultiplier ?? defaultArenaTuning.collisionLaunchMultiplier, 0.45, 3),
    sparkMultiplier: clamp(tuning?.sparkMultiplier ?? defaultArenaTuning.sparkMultiplier, 0.35, 2.5),
    activeEnemyPressure: clamp(tuning?.activeEnemyPressure ?? defaultArenaTuning.activeEnemyPressure, 0.4, 1.8),
    bossWeightMultiplier: clamp(tuning?.bossWeightMultiplier ?? defaultArenaTuning.bossWeightMultiplier, 0.65, 1.8),
    hitStopMultiplier: clamp(tuning?.hitStopMultiplier ?? defaultArenaTuning.hitStopMultiplier, 0.2, 2.2),
  };
}

type DropLabelOption = { label: string; target: TopPartSlotId; weight: number };

const dropLabelOptions: DropLabelOption[] = [
  { label: "Ash Core", target: "core", weight: 1 },
  { label: "Static Core", target: "core", weight: 0.86 },
  { label: "Void Core", target: "core", weight: 0.42 },
  { label: "Attack Ring", target: "attackRing", weight: 1 },
  { label: "Razor Ring", target: "attackRing", weight: 0.82 },
  { label: "Furnace Ring", target: "attackRing", weight: 0.7 },
  { label: "Weight Disk", target: "weightDisk", weight: 1 },
  { label: "Orbit Disk", target: "weightDisk", weight: 0.76 },
  { label: "Judicator Disk", target: "weightDisk", weight: 0.46 },
  { label: "Needle Tip", target: "tip", weight: 1 },
  { label: "Anchor Tip", target: "tip", weight: 0.78 },
  { label: "Molten Tip", target: "tip", weight: 0.68 },
  { label: "Launcher", target: "launcher", weight: 1 },
  { label: "Tempest Launcher", target: "launcher", weight: 0.7 },
  { label: "Storm Seal", target: "seal", weight: 0.92 },
  { label: "Ember Seal", target: "seal", weight: 0.72 },
  { label: "Null Seal", target: "seal", weight: 0.46 },
  { label: "Circuit Chip", target: "circuitChip", weight: 1 },
  { label: "Mapwright Chip", target: "circuitChip", weight: 0.74 },
  { label: "Omen Chip", target: "circuitChip", weight: 0.56 },
];

function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

function normalize(x: number, y: number): { x: number; y: number } {
  const magnitude = length(x, y) || 1;
  return { x: x / magnitude, y: y / magnitude };
}

function maxSpinEnergy(entity: TopRuntimeEntity): number {
  return Math.max(1, entity.maxSpinEnergy ?? entity.stats.maxSpinIntegrity);
}

function currentSpinEnergy(entity: TopRuntimeEntity): number {
  return entity.spinEnergy ?? clamp(entity.spinPower / 100, 0, 1.2) * maxSpinEnergy(entity);
}

function spinEnergyRatio(entity: TopRuntimeEntity): number {
  return clamp(currentSpinEnergy(entity) / maxSpinEnergy(entity), 0, 1.2);
}

function spinRatio(entity: TopRuntimeEntity): number {
  return spinEnergyRatio(entity);
}

function withSpinEnergy(entity: TopRuntimeEntity, spinEnergy: number): TopRuntimeEntity {
  const maxEnergy = maxSpinEnergy(entity);
  const nextEnergy = clamp(spinEnergy, 0, maxEnergy * 1.2);
  return {
    ...entity,
    maxSpinEnergy: maxEnergy,
    spinEnergy: nextEnergy,
    spinPower: maxEnergy > 0 ? (nextEnergy / maxEnergy) * 100 : 0,
  };
}

function drainSpinEnergy(entity: TopRuntimeEntity, amount: number): TopRuntimeEntity {
  return withSpinEnergy(entity, currentSpinEnergy(entity) - Math.max(0, amount));
}

function addSpinEnergy(entity: TopRuntimeEntity, amount: number): TopRuntimeEntity {
  return withSpinEnergy(entity, currentSpinEnergy(entity) + Math.max(0, amount));
}

function loseSpinPower(entity: TopRuntimeEntity, spinPowerLoss: number): TopRuntimeEntity {
  return drainSpinEnergy(entity, maxSpinEnergy(entity) * Math.max(0, spinPowerLoss) * 0.01 * balanceConfig.energy.collisionLossScalar);
}

function maxFlux(entity: TopRuntimeEntity): number {
  return Math.max(1, entity.maxFlux ?? resolveStatsPhysics(entity.stats).maxFlux);
}

function currentFlux(entity: TopRuntimeEntity): number {
  return entity.flux ?? maxFlux(entity);
}

function withFlux(entity: TopRuntimeEntity, flux: number): TopRuntimeEntity {
  const nextMaxFlux = maxFlux(entity);
  return {
    ...entity,
    maxFlux: nextMaxFlux,
    flux: clamp(flux, 0, nextMaxFlux),
  };
}

function addFlux(entity: TopRuntimeEntity, amount: number): TopRuntimeEntity {
  return withFlux(entity, currentFlux(entity) + Math.max(0, amount));
}

function spendFlux(entity: TopRuntimeEntity, amount: number): TopRuntimeEntity {
  return withFlux(entity, currentFlux(entity) - Math.max(0, amount));
}

function angularSurfaceSpeed(entity: TopRuntimeEntity): number {
  return entity.stats.rpm * spinRatio(entity) * entity.radius * 0.72;
}

function initialCooldownForBehavior(behaviorId: EnemyBehaviorId, rank: TopRuntimeEntity["rank"]): number {
  if (behaviorId === "bossJudicator") {
    return rank === "boss" ? 1.35 : 1;
  }
  if (behaviorId === "charger") {
    return 0.8;
  }
  if (behaviorId === "mineLayer") {
    return 1.05;
  }
  return 0.35;
}

function createMapKillTarget(arenaId: string, seed: string, routeClears: number, arenaKey?: ArenaKey): number {
  const rng = createRng(`${seed}_${arenaId}_${arenaKey?.id ?? "open"}_${routeClears}_map_goal`);
  return rng.int(minMapKillTarget, maxMapKillTarget);
}

function pushEvent(runtime: TopArenaRuntime, tone: ArenaLogEvent["tone"], text: string): TopArenaRuntime {
  const eventIndex = runtime.eventIndex + 1;
  return {
    ...runtime,
    eventIndex,
    events: [{ id: `top_event_${eventIndex}`, tone, text }, ...runtime.events].slice(0, maxEvents),
  };
}

function addEffect(runtime: TopArenaRuntime, effect: Omit<ArenaEffect, "id" | "age">): TopArenaRuntime {
  return {
    ...runtime,
    effects: [{ ...effect, id: `fx_${runtime.time}_${runtime.effects.length}`, age: 0 }, ...runtime.effects].slice(0, maxEffects),
  };
}

function createArenaEventState(arenaId: string, seed: string, arenaKey?: ArenaKey): ArenaEventState | undefined {
  const arena = getArenaCircuitDef(arenaId);
  const rng = createRng(`${seed}_${arenaId}_${arenaKey?.id ?? "open"}_event`);
  const candidates = arenaEvents.filter((event) => event.minTier <= arena.tier);
  if (candidates.length === 0) {
    return undefined;
  }

  const event = rng.weighted(candidates, (candidate) => candidate.weight);
  return {
    eventId: event.id,
    displayName: event.displayName,
    logText: event.logText,
    enemyIntegrityMultiplier: event.enemyIntegrityMultiplier ?? 1,
    enemyImpactMultiplier: event.enemyImpactMultiplier ?? 1,
    enemyGuardMultiplier: event.enemyGuardMultiplier ?? 1,
    enemyRpmMultiplier: event.enemyRpmMultiplier ?? 1,
    playerDriftMultiplier: event.playerDriftMultiplier ?? 1,
    rewardQuantity: event.rewardQuantity ?? 0,
    rewardRarity: event.rewardRarity ?? 0,
    rewardBias: event.rewardBias ?? [],
  };
}

function chooseEnemyModifier(arenaId: string, wave: number, seed: string): EnemyModifierDef {
  const arena = getArenaCircuitDef(arenaId);
  const rng = createRng(`${seed}_${arenaId}_${wave}_enemy_modifier`);
  const candidates = enemyModifiers.filter((modifier) => modifier.minTier <= arena.tier);
  return rng.weighted(candidates, (modifier) => modifier.weight);
}

function behaviorForEnemy(rank: TopRuntimeEntity["rank"], modifier: EnemyModifierDef): EnemyBehaviorId {
  if (rank === "boss") {
    return "bossJudicator";
  }
  if (modifier.id === "enemy_mod_redline_motor" || modifier.id === "enemy_mod_void_touched") {
    return "charger";
  }
  if (modifier.id === "enemy_mod_furnace_core") {
    return "mineLayer";
  }
  if (modifier.id === "enemy_mod_arc_lashed" || modifier.id === "enemy_mod_mirror_bitten") {
    return "orbiter";
  }
  return "hunter";
}

function createEnemyStats(arenaId: string, rank: TopRuntimeEntity["rank"], wave: number, arenaKey?: ArenaKey, activeEvent?: ArenaEventState, modifier?: EnemyModifierDef, loadout: TopLoadoutConfig = {}): TopRuntimeStats {
  const arena = getArenaCircuitDef(arenaId);
  const keyRisk = arenaKey ? summarizeArenaKeyRiskReward(arenaKey) : null;
  const atlasBonuses = resolveCircuitAtlasBonuses(loadout.circuitAtlasNodeIds ?? []);
  const earlyWaveEase = wave <= 8 ? 0.86 : 1;
  const rankScalar = rank === "boss" ? 3.2 * earlyWaveEase : rank === "elite" ? 1.45 * earlyWaveEase : 1;
  const waveScalar = 1 + Math.max(0, wave - 1) * 0.045;
  const resistanceBonuses = modifier?.resistanceBonuses ?? {};

  return {
    maxSpinIntegrity:
      arena.enemyIntegrity *
      rankScalar *
      waveScalar *
      (keyRisk?.enemyIntegrityMultiplier ?? 1) *
      (activeEvent?.enemyIntegrityMultiplier ?? 1) *
      (modifier?.integrityMultiplier ?? 1) *
      atlasBonuses.enemyIntegrityMultiplier,
    maxFluxGuard: arena.enemyIntegrity * 0.12 * rankScalar,
    guard: arena.enemyGuard * rankScalar * (keyRisk?.enemyGuardMultiplier ?? 1) * (activeEvent?.enemyGuardMultiplier ?? 1) * (modifier?.guardMultiplier ?? 1),
    drift: 260 + arena.tier * 60,
    tracking: 500 + arena.tier * 72,
    impact:
      arena.enemyImpact *
      rankScalar *
      (1 + wave * 0.025) *
      (keyRisk?.enemyImpactMultiplier ?? 1) *
      (activeEvent?.enemyImpactMultiplier ?? 1) *
      (modifier?.impactMultiplier ?? 1) *
      atlasBonuses.enemyImpactMultiplier,
    rpm: (rank === "boss" ? 4.2 : rank === "elite" ? 5.2 : 5.8) * (keyRisk?.enemyRpmMultiplier ?? 1) * (activeEvent?.enemyRpmMultiplier ?? 1) * (modifier?.rpmMultiplier ?? 1),
    mass: rank === "boss" ? 1.65 : rank === "elite" ? 1.25 : 1,
    grip: rank === "boss" ? 0.78 : rank === "elite" ? 0.58 : 0.42,
    edge: rank === "boss" ? 0.08 : 0.04,
    fracture: rank === "boss" ? 1.65 : 1.35,
    resonance: 0.7,
    partQuantity: 0,
    partRarity: 0,
    resistances: {
      ...zeroResistances(),
      impact: 0,
      heat: arena.tier * 0.04 + (resistanceBonuses.heat ?? 0),
      glass: arena.tier * 0.03 + (resistanceBonuses.glass ?? 0),
      static: arena.tier * 0.035 + (resistanceBonuses.static ?? 0),
      void: arena.tier * 0.025 + (resistanceBonuses.void ?? 0),
    },
    modifiers: [],
  };
}

function mapProgressRatio(runtime: Pick<TopArenaRuntime, "mapKills" | "mapKillTarget">): number {
  return clamp(runtime.mapKills / Math.max(1, runtime.mapKillTarget), 0, 1);
}

function activeSmallEnemyCount(runtime: TopArenaRuntime): number {
  return runtime.enemies.filter((enemy) => enemy.rank !== "boss").length;
}

function desiredSmallEnemyCount(runtime: TopArenaRuntime, tuning: ArenaTuningConfig = defaultArenaTuning): number {
  const arena = getArenaCircuitDef(runtime.arenaId);
  const atlasBonuses = resolveCircuitAtlasBonuses(runtime.loadout.circuitAtlasNodeIds ?? []);
  const breachPressure = runtime.routeMechanic?.active ? (runtime.routeMechanic.stabilized ? 0.18 : 0.1) : 0;
  const uniquePressure = hasEquippedBase(runtime, "part_core_magnet_heart") ? 0.1 : 0;
  const density = 9 + arena.tier * 2 + Math.floor(mapProgressRatio(runtime) * 6);
  return Math.min(maxActiveSmallEnemies, Math.max(4, Math.round(density * tuning.activeEnemyPressure * (1 + atlasBonuses.activeEnemyPressure + breachPressure + uniquePressure))));
}

function smallEnemyRankForSpawn(runtime: TopArenaRuntime, rng: ReturnType<typeof createRng>): TopRuntimeEntity["rank"] {
  const arena = getArenaCircuitDef(runtime.arenaId);
  const nextMapKill = runtime.mapKills + activeSmallEnemyCount(runtime) + 1;
  const eliteGate = nextMapKill > 0 && nextMapKill % 32 === 0;
  const eliteChance = 0.08 + arena.tier * 0.015 + mapProgressRatio(runtime) * 0.06;
  return eliteGate || rng.next() < eliteChance ? "elite" : "pack";
}

function difficultyWaveForRuntime(runtime: TopArenaRuntime): number {
  return 1 + runtime.routeClears * 3 + Math.floor(runtime.mapKills / 40);
}

function spawnEnemy(runtime: TopArenaRuntime, rankOverride?: TopRuntimeEntity["rank"], tuning: ArenaTuningConfig = defaultArenaTuning): TopArenaRuntime {
  const arena = getArenaCircuitDef(runtime.arenaId);
  const spawnIndex = runtime.spawnIndex + 1;
  const rng = createRng(`${runtime.seed}_${runtime.routeClears}_${runtime.mapKills}_${spawnIndex}`);
  const angle = rng.next() * Math.PI * 2;
  const rank = rankOverride ?? smallEnemyRankForSpawn(runtime, rng);
  const radius = rank === "boss" ? 38 : rank === "elite" ? 27 : 20;
  const difficultyWave = difficultyWaveForRuntime(runtime);
  const modifier = chooseEnemyModifier(runtime.arenaId, spawnIndex, runtime.seed);
  const behaviorId = behaviorForEnemy(rank, modifier);
  const baseStats = createEnemyStats(runtime.arenaId, rank, difficultyWave, runtime.arenaKey, runtime.activeEvent, modifier, runtime.loadout);
  const stats =
    rank === "boss"
      ? {
          ...baseStats,
          mass: baseStats.mass * tuning.bossWeightMultiplier,
          guard: baseStats.guard * (1 + (tuning.bossWeightMultiplier - 1) * 0.12),
          grip: clamp(baseStats.grip + (tuning.bossWeightMultiplier - 1) * 0.08, 0.45, 0.94),
        }
      : baseStats;
  const physics = resolveStatsPhysics(stats);
  const maxFlux = physics.maxFlux;
  const distance = arena.radius * (rank === "boss" ? 0.5 + rng.next() * 0.08 : 0.72 + rng.next() * 0.19);
  const baseName = rank === "boss" ? "Brass Judicator" : rank === "elite" ? "Scored Iron Rival" : "Cinder Runner";
  const enemy: TopRuntimeEntity = {
    id: `enemy_${spawnIndex}_${rank}`,
    team: "enemy",
    name: `${modifier.displayName} ${baseName}`,
    rank,
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    vx: -Math.cos(angle) * 26,
    vy: -Math.sin(angle) * 26,
    radius,
    angle: 0,
    spinIntegrity: stats.maxSpinIntegrity,
    fluxGuard: stats.maxFluxGuard,
    spinPower: 100,
    maxSpinEnergy: physics.spinEnergy,
    spinEnergy: physics.spinEnergy,
    maxFlux,
    flux: maxFlux,
    wobble: 0,
    cooldownRemaining: initialCooldownForBehavior(behaviorId, rank),
    stats,
    behaviorId,
    bossPhase: rank === "boss" ? 1 : undefined,
    phaseGateCooldown: 0,
    enemyModifier: {
      modifierId: modifier.id,
      displayName: modifier.displayName,
      rewardQuantity: modifier.rewardQuantity ?? 0,
      rewardRarity: modifier.rewardRarity ?? 0,
    },
  };

  let nextRuntime = addEffect(
    pushEvent(
      {
        ...runtime,
        spawnIndex,
        enemies: [...runtime.enemies, enemy],
        bossSpawned: runtime.bossSpawned || rank === "boss",
        nextEnemyIn: rank === "boss" ? 1.4 : activeSmallEnemyCount(runtime) < desiredSmallEnemyCount(runtime, tuning) - 1 ? 0.09 : 0.22,
      },
      "danger",
      rank === "boss" ? `${enemy.name} drops into the basin` : `${enemy.name} enters the basin`,
    ),
    {
      kind: "spawn",
      x: enemy.x,
      y: enemy.y,
      lifetime: 0.75,
      intensity: rank === "boss" ? 1.8 : 1,
    },
  );

  if (rank === "boss") {
    nextRuntime = addEffect(nextRuntime, {
      kind: "bossSignal",
      x: 0,
      y: 0,
      lifetime: 1.15,
      intensity: 1.6,
    });
    nextRuntime = addEffect(nextRuntime, {
      kind: "shockwave",
      x: enemy.x,
      y: enemy.y,
      lifetime: 0.82,
      intensity: 2.2,
    });
  }

  return nextRuntime;
}

function createPlayer(frameId: string, driveId: string, loadout: TopLoadoutConfig = {}, activeEvent?: ArenaEventState): TopRuntimeEntity {
  const frame = getTopFrameDef(frameId);
  const resolvedStats = resolveTopRuntimeStats(frameId, driveId, loadout);
  const stats = activeEvent ? { ...resolvedStats, drift: resolvedStats.drift * activeEvent.playerDriftMultiplier } : resolvedStats;
  const physics = resolveStatsPhysics(stats);
  const maxFlux = physics.maxFlux;

  return {
    id: "player_top",
    team: "player",
    name: frame.displayName,
    rank: "player",
    x: 0,
    y: 0,
    vx: 32,
    vy: -18,
    radius: 26,
    angle: 0,
    spinIntegrity: stats.maxSpinIntegrity,
    fluxGuard: stats.maxFluxGuard,
    spinPower: 100,
    maxSpinEnergy: physics.spinEnergy,
    spinEnergy: physics.spinEnergy,
    maxFlux,
    flux: maxFlux,
    wobble: 0,
    cooldownRemaining: 0,
    stats,
    driveId,
  };
}

function createRouteMechanicState(loadout: TopLoadoutConfig = {}): NonNullable<TopArenaRuntime["routeMechanic"]> {
  const atlasBonuses = resolveCircuitAtlasBonuses(loadout.circuitAtlasNodeIds ?? []);
  const maxTime = 28 + atlasBonuses.breachDuration + (hasEquippedBase({ loadout }, "part_core_magnet_heart") ? 3 : 0);

  return {
    id: "breach_rail",
    displayName: "Breach Rail",
    active: true,
    progress: 0,
    maxProgress: 100,
    timeRemaining: maxTime,
    maxTime,
    stabilized: false,
    rewardQuantity: 0.06 + atlasBonuses.rewardQuantity * 0.35,
    rewardRarity: 0.02 + atlasBonuses.rewardRarity * 0.25,
  };
}

export function createTopArenaRuntime({
  arenaId,
  frameId,
  driveId,
  loadout = {},
  seed = "top_arena",
  arenaKey,
}: {
  arenaId: string;
  frameId: string;
  driveId: string;
  loadout?: TopLoadoutConfig;
  seed?: string;
  arenaKey?: ArenaKey;
}): TopArenaRuntime {
  const activeEvent = createArenaEventState(arenaId, seed, arenaKey);
  const routeMechanic = createRouteMechanicState(loadout);
  const initialEvents: ArenaLogEvent[] = [
    ...(activeEvent ? [{ id: "top_event_event", tone: "danger" as const, text: `${activeEvent.displayName}: ${activeEvent.logText}` }] : []),
    { id: "top_event_route", tone: "reward" as const, text: `${routeMechanic.displayName} opened; shatter rivals before it collapses` },
    { id: "top_event_0", tone: "reward" as const, text: "Arena coil is armed" },
  ].slice(0, maxEvents);
  const mapKillTarget = createMapKillTarget(arenaId, seed, 0, arenaKey);

  return {
    seed,
    arenaId,
    arenaKey,
    activeEvent,
    routeMechanic,
    frameId,
    driveId,
    loadout,
    time: 0,
    wave: 1,
    kills: 0,
    mapKills: 0,
    mapKillTarget,
    bossSpawned: false,
    spawnIndex: 0,
    routeClears: 0,
    nextEnemyIn: 0.2,
    routeTransitionCooldown: 0,
    eventIndex: 0,
    player: createPlayer(frameId, driveId, loadout, activeEvent),
    enemies: [],
    effects: [],
    drops: [],
    events: initialEvents,
    lastCollision: undefined,
    collisionContacts: {},
  };
}

function steerEntity(entity: TopRuntimeEntity, target: TopRuntimeEntity | null, arenaRadius: number, deltaSeconds: number, tuning: ArenaTuningConfig = defaultArenaTuning): TopRuntimeEntity {
  let desiredX = -entity.x * 0.25;
  let desiredY = -entity.y * 0.25;

  if (target) {
    const toTargetX = target.x - entity.x;
    const toTargetY = target.y - entity.y;
    if (entity.behaviorId === "orbiter") {
      desiredX = toTargetX * 0.42 - toTargetY * 0.74;
      desiredY = toTargetY * 0.42 + toTargetX * 0.74;
    } else if (entity.behaviorId === "mineLayer") {
      const distanceToTarget = length(toTargetX, toTargetY);
      const retreat = distanceToTarget < 120 ? -0.65 : 0.34;
      desiredX = toTargetX * retreat - entity.x * 0.12;
      desiredY = toTargetY * retreat - entity.y * 0.12;
    } else {
      desiredX = toTargetX;
      desiredY = toTargetY;
    }
  }

  const direction = normalize(desiredX, desiredY);
  const behaviorAcceleration =
    entity.behaviorId === "charger" ? 1.18 : entity.behaviorId === "orbiter" ? 0.92 : entity.behaviorId === "mineLayer" ? 0.78 : entity.behaviorId === "bossJudicator" ? 0.72 : 1;
  const behaviorSpeed =
    entity.behaviorId === "charger" ? 1.18 : entity.behaviorId === "orbiter" ? 1.08 : entity.behaviorId === "mineLayer" ? 0.86 : entity.behaviorId === "bossJudicator" ? 0.74 : 1;
  const controlRatio = clamp(spinRatio(entity) * (1 - entity.wobble * 0.45), 0.18, 1.15);
  const acceleration = entity.stats.rpm * (entity.team === "player" ? 34 : 26) * behaviorAcceleration * controlRatio;
  const maxSpeed = (88 + entity.stats.rpm * 14) * behaviorSpeed * clamp(0.72 + controlRatio * 0.34, 0.55, 1.08);
  let vx = entity.vx + direction.x * acceleration * deltaSeconds;
  let vy = entity.vy + direction.y * acceleration * deltaSeconds;
  const distanceBeforeMove = length(entity.x, entity.y);
  if (distanceBeforeMove > 0.001) {
    const slopeRatio = clamp(distanceBeforeMove / Math.max(1, arenaRadius), 0, 1);
    const centerPull = normalize(-entity.x, -entity.y);
    const slopeForce = 0.34 + Math.pow(slopeRatio, 0.78) * 1.68;
    const basinAcceleration =
      (entity.team === "player" ? 132 : 154) *
      slopeForce *
      tuning.basinPullMultiplier *
      clamp(1.16 - entity.stats.grip * 0.24, 0.74, 1.2) *
      (0.72 + controlRatio * 0.42);
    vx += centerPull.x * basinAcceleration * deltaSeconds;
    vy += centerPull.y * basinAcceleration * deltaSeconds;
  }
  let speed = length(vx, vy);

  if (speed > maxSpeed) {
    const originalSpeed = speed;
    const excessSpeed = speed - maxSpeed;
    const recoilDecay = clamp(deltaSeconds * (0.82 + entity.stats.grip * 0.5), 0.04, 0.26);
    const recoilSpeedLimit = maxSpeed * (entity.team === "player" ? 3.25 : 3.55) * clamp(0.82 + tuning.collisionLaunchMultiplier * 0.22, 0.9, 1.42);
    speed = Math.min(recoilSpeedLimit, maxSpeed + excessSpeed * (1 - recoilDecay));
    vx = (vx / originalSpeed) * speed;
    vy = (vy / originalSpeed) * speed;
  }

  let x = entity.x + vx * deltaSeconds;
  let y = entity.y + vy * deltaSeconds;
  const distanceFromCenter = length(x, y);

  if (distanceFromCenter + entity.radius > arenaRadius) {
    const normal = normalize(x, y);
    x = normal.x * (arenaRadius - entity.radius);
    y = normal.y * (arenaRadius - entity.radius);
    const dot = vx * normal.x + vy * normal.y;
    vx = (vx - 2 * dot * normal.x) * (0.55 + entity.stats.grip * 0.22);
    vy = (vy - 2 * dot * normal.y) * (0.55 + entity.stats.grip * 0.22);
    speed = length(vx, vy);
  }

  const physics = resolveStatsPhysics(entity.stats, { spinEnergy: currentSpinEnergy(entity) });
  const frictionDrain = balanceConfig.energy.frictionLossPerMassPerSecond * physics.designMass * deltaSeconds;
  const spinState = drainSpinEnergy(entity, frictionDrain);
  const wobbleRecovery = Math.max(0, entity.wobble - (0.28 + entity.stats.grip * 0.18) * deltaSeconds);

  return {
    ...spinState,
    x,
    y,
    vx,
    vy,
    angle: entity.angle + entity.stats.rpm * spinRatio(entity) * deltaSeconds * 4.5,
    wobble: wobbleRecovery,
    cooldownRemaining: Math.max(0, entity.cooldownRemaining - deltaSeconds),
    phaseGateCooldown: entity.phaseGateCooldown === undefined ? undefined : Math.max(0, entity.phaseGateCooldown - deltaSeconds),
  };
}

type CollisionDamageContext = Pick<TopCollisionEvent, "kind" | "normalImpulse" | "tangentImpulse" | "relativeNormalSpeed" | "relativeTangentialSpeed" | "surfaceShear" | "sparkIntensity" | "contactAge" | "heavy">;

function createCollisionDamage(attacker: TopRuntimeEntity, defender: TopRuntimeEntity, collision?: CollisionDamageContext): ReturnType<typeof emptyDamagePacket> {
  const relativeSpeed = length(attacker.vx - defender.vx, attacker.vy - defender.vy);
  const impulseDamage = collision
    ? collision.normalImpulse * (0.3 + attacker.stats.edge * 1.25) + Math.abs(collision.tangentImpulse) * (0.16 + attacker.stats.grip * 0.08)
    : relativeSpeed * attacker.stats.mass * 0.38;
  const spinFactor = 0.68 + spinRatio(attacker) * 0.42;
  const kindFactor = collision?.kind === "smash" ? 1.28 : collision?.kind === "scrape" ? 0.88 : collision?.kind === "grind" ? 0.74 : 1;
  const heavyFactor = collision?.heavy ? 1.16 : 1;
  const playerIncomingScalar = defender.team === "player" ? (attacker.rank === "boss" ? 0.78 : attacker.rank === "elite" ? 0.68 : 0.54) : 1;
  const packet = emptyDamagePacket();
  packet.impact = (attacker.stats.impact * spinFactor + impulseDamage + relativeSpeed * attacker.stats.mass * 0.08) * heavyFactor * kindFactor * playerIncomingScalar;
  return packet;
}

function createSkillDamage(attacker: TopRuntimeEntity, collision?: CollisionDamageContext, behaviors: ActiveRuneBehaviors = {}): ReturnType<typeof emptyDamagePacket> {
  const drive = getDriveCoreDef(attacker.driveId ?? "drive_shard_barrage");
  const packet = { ...drive.baseDamage };

  if (drive.visual === "emberTrail") {
    packet.heat += attacker.stats.resonance * 42;
  }
  if (drive.visual === "stormArc") {
    packet.static += attacker.stats.rpm * 7;
  }
  if (drive.visual === "sparks") {
    packet.impact += attacker.stats.impact * 0.4;
  }
  if (collision && (drive.trigger === "onCollision" || drive.trigger === "onHeavyCollision")) {
    const scrapeBonus = collision.kind === "scrape" ? collision.surfaceShear * 0.28 + Math.abs(collision.tangentImpulse) * 0.34 : 0;
    const smashBonus = collision.kind === "smash" ? collision.normalImpulse * 0.42 : 0;
    packet.impact += collision.normalImpulse * 0.2 + Math.abs(collision.tangentImpulse) * (0.22 + attacker.stats.edge) + scrapeBonus + smashBonus;
    packet.impact *= collision.heavy ? 1.14 : 1;
  }
  if (collision && drive.id === "drive_shard_barrage") {
    packet.impact += collision.surfaceShear * 0.2 + Math.abs(collision.tangentImpulse) * 0.3;
  }
  if (collision && drive.id === "drive_ember_scour") {
    packet.heat += collision.surfaceShear * 0.18 + (collision.kind === "grind" ? collision.contactAge * 90 : 0);
  }
  if (collision && drive.id === "drive_molten_groove") {
    packet.heat += collision.surfaceShear * 0.26 + collision.contactAge * 120;
  }
  if (collision && drive.id === "drive_storm_lattice") {
    packet.static += collision.sparkIntensity * 34 + attacker.stats.rpm * 5;
  }
  if (collision && drive.id === "drive_chain_tempest") {
    packet.static += collision.sparkIntensity * 48 + (collision.heavy ? collision.normalImpulse * 0.32 : collision.surfaceShear * 0.12);
  }
  if (behaviorCount(behaviors, "projectileCount") > 0 && drive.tags.includes("projectile")) {
    packet.impact += attacker.stats.impact * 0.22 * behaviorCount(behaviors, "projectileCount");
    packet.glass += attacker.stats.edge * 180 * behaviorCount(behaviors, "projectileCount");
  }
  if (behaviorCount(behaviors, "area") > 0 && drive.tags.includes("area")) {
    packet.impact += attacker.stats.impact * 0.12 * behaviorCount(behaviors, "area");
    packet.heat += attacker.stats.resonance * 24 * behaviorCount(behaviors, "area");
  }
  if (behaviorCount(behaviors, "chain") > 0 && drive.tags.includes("chain")) {
    packet.static += attacker.stats.tracking * 0.08 * behaviorCount(behaviors, "chain");
  }
  if (behaviorCount(behaviors, "repeat") > 0) {
    packet.impact += attacker.stats.rpm * 4.2 * behaviorCount(behaviors, "repeat");
  }
  if (behaviorCount(behaviors, "risk") > 0) {
    packet.impact *= 1 + 0.08 * behaviorCount(behaviors, "risk");
    packet.heat *= 1 + 0.08 * behaviorCount(behaviors, "risk");
    packet.static *= 1 + 0.08 * behaviorCount(behaviors, "risk");
    packet.void += attacker.stats.resonance * 20 * behaviorCount(behaviors, "risk");
  }

  return packet;
}

function damagePlayer(runtime: TopArenaRuntime, amount: number, impulseX = 0, impulseY = 0): TopArenaRuntime {
  const player = drainSpinEnergy(runtime.player, amount);
  return {
    ...runtime,
    player: {
      ...player,
      spinIntegrity: Math.max(0, runtime.player.spinIntegrity - amount),
      vx: player.vx + impulseX,
      vy: player.vy + impulseY,
    },
  };
}

function bossPhaseFor(enemy: TopRuntimeEntity): 1 | 2 | 3 {
  if (enemy.rank !== "boss") {
    return 1;
  }

  const ratio = clamp(enemy.spinIntegrity / Math.max(1, enemy.stats.maxSpinIntegrity), 0, 1);
  return ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1;
}

function applyBossPhaseGate(
  defender: TopRuntimeEntity,
  damage: number,
): {
  nextSpinIntegrity: number;
  appliedDamage: number;
  bossPhase?: 1 | 2 | 3;
  phaseGateCooldown?: number;
  phaseChanged: boolean;
} {
  if (defender.rank !== "boss") {
    const nextSpinIntegrity = Math.max(0, defender.spinIntegrity - damage);
    return {
      nextSpinIntegrity,
      appliedDamage: defender.spinIntegrity - nextSpinIntegrity,
      bossPhase: defender.bossPhase,
      phaseGateCooldown: defender.phaseGateCooldown,
      phaseChanged: false,
    };
  }

  const currentPhase = defender.bossPhase ?? bossPhaseFor(defender);
  if ((defender.phaseGateCooldown ?? 0) > 0) {
    return {
      nextSpinIntegrity: defender.spinIntegrity,
      appliedDamage: 0,
      bossPhase: currentPhase,
      phaseGateCooldown: defender.phaseGateCooldown,
      phaseChanged: false,
    };
  }

  const maxIntegrity = Math.max(1, defender.stats.maxSpinIntegrity);
  const rawNextSpinIntegrity = Math.max(0, defender.spinIntegrity - damage);
  const phaseTwoGate = maxIntegrity * bossPhaseTwoGateRatio;
  const phaseThreeGate = maxIntegrity * bossPhaseThreeGateRatio;

  if (currentPhase === 1 && rawNextSpinIntegrity <= phaseTwoGate) {
    return {
      nextSpinIntegrity: phaseTwoGate,
      appliedDamage: Math.max(0, defender.spinIntegrity - phaseTwoGate),
      bossPhase: 2,
      phaseGateCooldown: bossPhaseGateCooldownSeconds,
      phaseChanged: true,
    };
  }

  if (currentPhase === 2 && rawNextSpinIntegrity <= phaseThreeGate) {
    return {
      nextSpinIntegrity: phaseThreeGate,
      appliedDamage: Math.max(0, defender.spinIntegrity - phaseThreeGate),
      bossPhase: 3,
      phaseGateCooldown: bossPhaseGateCooldownSeconds,
      phaseChanged: true,
    };
  }

  return {
    nextSpinIntegrity: rawNextSpinIntegrity,
    appliedDamage: defender.spinIntegrity - rawNextSpinIntegrity,
    bossPhase: currentPhase,
    phaseGateCooldown: defender.phaseGateCooldown,
    phaseChanged: false,
  };
}

function dealDamage(
  runtime: TopArenaRuntime,
  attacker: TopRuntimeEntity,
  defender: TopRuntimeEntity,
  source: "collision" | "skill",
  collision?: CollisionDamageContext,
  damageScalar = 1,
): { runtime: TopArenaRuntime; defender: TopRuntimeEntity } {
  const drive = getDriveCoreDef(attacker.team === "player" ? attacker.driveId ?? runtime.driveId : "drive_shard_barrage");
  const runeBehaviors = attacker.team === "player" ? activeRuneBehaviors(runtime) : {};
  let baseDamage = source === "collision" ? createCollisionDamage(attacker, defender, collision) : createSkillDamage(attacker, collision, runeBehaviors);
  if (source === "collision" && attacker.team === "player" && collision?.heavy && hasEquippedBase(runtime, "part_tip_glass_rebound")) {
    baseDamage = {
      ...baseDamage,
      glass: baseDamage.glass + collision.normalImpulse * 0.2 + Math.abs(collision.tangentImpulse) * 0.12,
    };
  }
  const hit = resolveTopHit({
    baseDamage,
    attacker: attacker.stats,
    defender: defender.stats,
    drive,
    sourceTags: source === "collision" ? ["attack", "melee"] : drive.tags,
  });
  const defenderPhase = defender.rank === "boss" ? bossPhaseFor(defender) : undefined;
  const phaseDamageScalar = defenderPhase === 3 && source === "collision" && !collision?.heavy ? 0.42 : 1;
  const defenseRuneScalar = defender.team === "player" && behaviorCount(activeRuneBehaviors(runtime), "defense") > 0 ? (source === "collision" ? 0.9 : 0.86) : 1;
  const totalDamage = hit.totalDamage * damageScalar * phaseDamageScalar * defenseRuneScalar;
  const bossGate = applyBossPhaseGate(defender, totalDamage);
  const impulseDirection = normalize(defender.x - attacker.x, defender.y - attacker.y);
  const skillImpulse = source === "skill" ? Math.min(120, bossGate.appliedDamage / defender.stats.mass) * 0.08 : 0;
  const damagedDefender = drainSpinEnergy(defender, bossGate.appliedDamage);
  const defenderNext = {
    ...damagedDefender,
    spinIntegrity: bossGate.nextSpinIntegrity,
    vx: damagedDefender.vx + impulseDirection.x * skillImpulse,
    vy: damagedDefender.vy + impulseDirection.y * skillImpulse,
    wobble: source === "collision" ? clamp(defender.wobble + bossGate.appliedDamage / Math.max(1, defender.stats.maxSpinIntegrity) * 0.3, 0, 1) : defender.wobble,
    bossPhase: defender.rank === "boss" ? bossGate.bossPhase : defender.bossPhase,
    phaseGateCooldown: defender.rank === "boss" ? bossGate.phaseGateCooldown : defender.phaseGateCooldown,
  };
  const midpointX = (attacker.x + defender.x) / 2;
  const midpointY = (attacker.y + defender.y) / 2;
  let nextRuntime = addEffect(runtime, {
    kind: source === "skill" ? (drive.visual === "stormArc" ? "stormArc" : drive.visual === "emberTrail" ? "emberTrail" : "spark") : "spark",
    x: midpointX,
    y: midpointY,
    x2: source === "skill" && drive.visual === "stormArc" ? defender.x : undefined,
    y2: source === "skill" && drive.visual === "stormArc" ? defender.y : undefined,
    lifetime: source === "skill" ? 0.55 : 0.24,
    intensity: clamp(Math.max(bossGate.appliedDamage, totalDamage * 0.18) / 180, 0.45, 2.2),
  });
  if (attacker.team === "player" && bossGate.appliedDamage > 0) {
    nextRuntime = { ...nextRuntime, player: addFlux(nextRuntime.player, balanceConfig.flux.hitRegen) };
  }

  if (defender.rank === "boss" && defenderNext.bossPhase && bossGate.phaseChanged) {
    nextRuntime = addEffect(pushEvent(nextRuntime, "danger", `${defender.name} enters phase ${defenderNext.bossPhase}`), {
      kind: defenderNext.bossPhase === 3 ? "shockwave" : "bossSignal",
      x: defender.x,
      y: defender.y,
      lifetime: defenderNext.bossPhase === 3 ? 0.85 : 0.7,
      intensity: defenderNext.bossPhase === 3 ? 2.25 : 1.55,
    });
  }

  if (source === "skill") {
    nextRuntime = pushEvent(nextRuntime, "skill", `${drive.displayName} hits for ${Math.round(bossGate.appliedDamage).toLocaleString()}`);
  }

  return { runtime: nextRuntime, defender: defenderNext };
}

function resolveEnemySkills(runtime: TopArenaRuntime): TopArenaRuntime {
  let nextRuntime = runtime;
  let player = runtime.player;
  const enemies: TopRuntimeEntity[] = [];

  for (const enemy of runtime.enemies) {
    let nextEnemy = enemy;
    const toPlayer = normalize(player.x - enemy.x, player.y - enemy.y);
    const distanceToPlayer = length(player.x - enemy.x, player.y - enemy.y);

    if (enemy.behaviorId === "charger" && enemy.cooldownRemaining <= 0 && distanceToPlayer > enemy.radius + player.radius + 44) {
      const impulse = 170 + enemy.stats.rpm * 9;
      nextEnemy = {
        ...nextEnemy,
        vx: nextEnemy.vx + toPlayer.x * impulse,
        vy: nextEnemy.vy + toPlayer.y * impulse,
        cooldownRemaining: 2.4,
      };
      nextRuntime = pushEvent(nextRuntime, "danger", `${enemy.name} redlines into a charge`);
      nextRuntime = addEffect(nextRuntime, {
        kind: "chargeLine",
        x: enemy.x,
        y: enemy.y,
        x2: player.x,
        y2: player.y,
        lifetime: 0.38,
        intensity: enemy.rank === "elite" ? 1.4 : 1,
      });
    }

    if (enemy.behaviorId === "mineLayer" && enemy.cooldownRemaining <= 0) {
      nextEnemy = { ...nextEnemy, cooldownRemaining: 2.9 };
      nextRuntime = pushEvent(nextRuntime, "danger", `${enemy.name} scores a furnace groove`);
      nextRuntime = addEffect(nextRuntime, {
        kind: "hazard",
        x: player.x - toPlayer.x * 18,
        y: player.y - toPlayer.y * 18,
        lifetime: 3.1,
        intensity: enemy.rank === "elite" ? 1.35 : 1,
      });
    }

    if (enemy.behaviorId === "bossJudicator" && enemy.cooldownRemaining <= 0) {
      const phase = bossPhaseFor(enemy);
      const atlasBonuses = resolveCircuitAtlasBonuses(runtime.loadout.circuitAtlasNodeIds ?? []);
      const direction = normalize(player.x - enemy.x, player.y - enemy.y);
      const phasePressure = 1 + (phase - 1) * 0.18 + atlasBonuses.bossPhasePressure;
      const shockDamage = (72 + enemy.stats.impact * 0.24) * phasePressure;
      nextEnemy = { ...nextEnemy, bossPhase: phase, cooldownRemaining: phase === 1 ? 3.4 : phase === 2 ? 2.65 : 2.15 };
      nextRuntime = pushEvent(
        nextRuntime,
        "danger",
        phase === 1 ? `${enemy.name} releases Judicator shockwave` : phase === 2 ? `${enemy.name} opens phase 2 rail pressure` : `${enemy.name} enters phase 3 brass lock`,
      );
      nextRuntime = addEffect(nextRuntime, {
        kind: phase === 2 ? "bossSignal" : "shockwave",
        x: enemy.x,
        y: enemy.y,
        lifetime: phase === 3 ? 1.05 : 0.9,
        intensity: phase === 3 ? 2.55 : phase === 2 ? 1.8 : 2.1,
      });
      if (phase >= 2) {
        nextRuntime = { ...nextRuntime, nextEnemyIn: Math.min(nextRuntime.nextEnemyIn, phase === 3 ? 0.02 : 0.05) };
      }
      if (phase === 3) {
        nextRuntime = addEffect(nextRuntime, {
          kind: "chargeLine",
          x: enemy.x,
          y: enemy.y,
          x2: player.x,
          y2: player.y,
          lifetime: 0.42,
          intensity: 1.4,
        });
      }
      if (distanceToPlayer < 190) {
        nextRuntime = damagePlayer(nextRuntime, shockDamage, direction.x * (phase === 3 ? 70 : 48), direction.y * (phase === 3 ? 70 : 48));
        player = nextRuntime.player;
      }
    }

    enemies.push(nextEnemy);
  }

  return { ...nextRuntime, player, enemies };
}

function resolveHazards(runtime: TopArenaRuntime, deltaSeconds: number): TopArenaRuntime {
  return runtime.effects
    .filter((effect) => effect.kind === "hazard")
    .reduce((nextRuntime, effect) => {
      if (effect.age < 0.45) {
        return nextRuntime;
      }

      const distanceToPlayer = length(nextRuntime.player.x - effect.x, nextRuntime.player.y - effect.y);
      const radius = 58 * effect.intensity;
      if (distanceToPlayer > radius) {
        return nextRuntime;
      }

      const damage = (22 + 16 * effect.intensity) * deltaSeconds * (1 - clamp(nextRuntime.player.stats.resistances.heat, -0.75, 0.85));
      const direction = normalize(nextRuntime.player.x - effect.x, nextRuntime.player.y - effect.y);
      return damagePlayer(nextRuntime, damage, direction.x * 6 * deltaSeconds, direction.y * 6 * deltaSeconds);
    }, runtime);
}

function biasWeight(target: TopPartSlotId, biases: ArenaRewardBias[]): number {
  return biases.reduce((weight, bias) => {
    if (bias.target === target || bias.target === "any") {
      return weight + bias.weight;
    }
    return weight;
  }, 1);
}

function chooseDropOption(runtime: TopArenaRuntime, rng: ReturnType<typeof createRng>, keyRisk: ReturnType<typeof summarizeArenaKeyRiskReward> | null): DropLabelOption {
  const biases = [...(keyRisk?.rewardBias ?? []), ...(runtime.activeEvent?.rewardBias ?? [])];
  return rng.weighted(dropLabelOptions, (option) => option.weight * biasWeight(option.target, biases));
}

function routeRewardBonuses(runtime: TopArenaRuntime): { rewardQuantity: number; rewardRarity: number } {
  const atlasBonuses = resolveCircuitAtlasBonuses(runtime.loadout.circuitAtlasNodeIds ?? []);
  const routeMechanic = runtime.routeMechanic;
  const stabilizedReward = routeMechanic?.stabilized ? 0.12 : 0;
  const activeReward = routeMechanic?.active || routeMechanic?.stabilized ? routeMechanic.rewardQuantity : 0;
  const mapwrightReward = routeMechanic?.stabilized && hasEquippedBase(runtime, "part_chip_mapwright_contract") ? 0.14 : 0;

  return {
    rewardQuantity: atlasBonuses.rewardQuantity + activeReward + stabilizedReward + mapwrightReward,
    rewardRarity: atlasBonuses.rewardRarity + (routeMechanic?.active || routeMechanic?.stabilized ? routeMechanic.rewardRarity : 0) + (routeMechanic?.stabilized ? 0.08 : 0),
  };
}

function advanceRouteMechanic(runtime: TopArenaRuntime, enemy: TopRuntimeEntity): TopArenaRuntime {
  const routeMechanic = runtime.routeMechanic;
  if (!routeMechanic?.active || routeMechanic.stabilized) {
    return runtime;
  }

  const atlasBonuses = resolveCircuitAtlasBonuses(runtime.loadout.circuitAtlasNodeIds ?? []);
  const rankGain = enemy.rank === "boss" ? 100 : enemy.rank === "elite" ? 11 : 5.5;
  const uniqueGain = hasEquippedBase(runtime, "part_core_magnet_heart") ? 0.08 : 0;
  const progressGain = rankGain * (1 + atlasBonuses.breachProgressGain + uniqueGain);
  const progress = Math.min(routeMechanic.maxProgress, routeMechanic.progress + progressGain);
  const timeRemaining = Math.min(routeMechanic.maxTime, routeMechanic.timeRemaining + (enemy.rank === "elite" ? 1.4 : 0.55));
  const stabilized = progress >= routeMechanic.maxProgress;
  let nextRuntime: TopArenaRuntime = {
    ...runtime,
    routeMechanic: {
      ...routeMechanic,
      progress,
      timeRemaining,
      stabilized,
      active: stabilized ? false : routeMechanic.active,
      rewardQuantity: routeMechanic.rewardQuantity + (stabilized ? 0.08 + atlasBonuses.rewardQuantity * 0.25 : 0),
      rewardRarity: routeMechanic.rewardRarity + (stabilized ? 0.04 + atlasBonuses.rewardRarity * 0.2 : 0),
    },
  };

  if (stabilized) {
    nextRuntime = addEffect(pushEvent(nextRuntime, "reward", "Breach Rail stabilized; route rewards amplified"), {
      kind: "bossSignal",
      x: 0,
      y: 0,
      lifetime: 1,
      intensity: 1.35,
    });
    nextRuntime = { ...nextRuntime, nextEnemyIn: Math.min(nextRuntime.nextEnemyIn, 0.06) };
  }

  return nextRuntime;
}

function tickRouteMechanic(runtime: TopArenaRuntime, deltaSeconds: number): TopArenaRuntime {
  const routeMechanic = runtime.routeMechanic;
  if (!routeMechanic?.active || routeMechanic.stabilized) {
    return runtime;
  }

  const timeRemaining = Math.max(0, routeMechanic.timeRemaining - deltaSeconds);
  const nextRuntime: TopArenaRuntime = {
    ...runtime,
    routeMechanic: {
      ...routeMechanic,
      timeRemaining,
      active: timeRemaining > 0,
    },
  };

  if (timeRemaining > 0) {
    return nextRuntime;
  }

  return pushEvent(nextRuntime, "danger", "Breach Rail collapsed before stabilization");
}

function handleDrops(runtime: TopArenaRuntime, enemy: TopRuntimeEntity): TopArenaRuntime {
  const arena = getArenaCircuitDef(runtime.arenaId);
  const keyRisk = runtime.arenaKey ? summarizeArenaKeyRiskReward(runtime.arenaKey) : null;
  const rng = createRng(`${runtime.seed}_drop_${runtime.wave}_${runtime.kills}`);
  const routeRewards = routeRewardBonuses(runtime);
  const rewardQuantity = (keyRisk?.rewardQuantity ?? 0) + (runtime.activeEvent?.rewardQuantity ?? 0) + (enemy.enemyModifier?.rewardQuantity ?? 0) + routeRewards.rewardQuantity;
  const rewardRarity = (keyRisk?.rewardRarity ?? 0) + (runtime.activeEvent?.rewardRarity ?? 0) + (enemy.enemyModifier?.rewardRarity ?? 0) + routeRewards.rewardRarity;
  const dropChance = clamp(0.26 * arena.rewardMultiplier * (1 + rewardQuantity) * (1 + runtime.player.stats.partQuantity), 0.08, 0.95);

  if (rng.next() > dropChance) {
    return runtime;
  }

  const rarityRoll = rng.next() * (1 + runtime.player.stats.partRarity + arena.tier * 0.05 + rewardRarity);
  const rarity: ArenaDrop["rarity"] = rarityRoll > 0.98 ? "relic" : rarityRoll > 0.62 ? "engraved" : rarityRoll > 0.28 ? "tuned" : "common";
  const dropOption = chooseDropOption(runtime, rng, keyRisk);
  const drop: ArenaDrop = {
    id: `drop_${runtime.wave}_${runtime.kills}`,
    label: dropOption.label,
    slot: dropOption.target,
    rarity,
    x: enemy.x,
    y: enemy.y,
    age: 0,
  };

  return addEffect(
    pushEvent({ ...runtime, drops: [drop, ...runtime.drops].slice(0, maxDrops) }, "drop", `${rarity} ${drop.label} dropped`),
    {
      kind: "drop",
      x: enemy.x,
      y: enemy.y,
      lifetime: 0.9,
      intensity: rarity === "relic" ? 2 : rarity === "engraved" ? 1.45 : 1,
    },
  );
}

function handleKills(runtime: TopArenaRuntime): TopArenaRuntime {
  let nextRuntime = runtime;
  const survivors: TopRuntimeEntity[] = [];

  for (const enemy of runtime.enemies) {
    if (enemy.spinIntegrity > 0) {
      survivors.push(enemy);
      continue;
    }

    const routeCleared = enemy.rank === "boss";
    const nextRouteClears = nextRuntime.routeClears + (routeCleared ? 1 : 0);
    const nextMapKills = routeCleared ? 0 : Math.min(nextRuntime.mapKillTarget, nextRuntime.mapKills + 1);
    const bossNowReady = !routeCleared && nextRuntime.mapKills < nextRuntime.mapKillTarget && nextMapKills >= nextRuntime.mapKillTarget;
    nextRuntime = pushEvent(nextRuntime, "kill", `${enemy.name} shattered`);
    nextRuntime = advanceRouteMechanic(nextRuntime, enemy);
    nextRuntime = handleDrops(nextRuntime, enemy);
    const rewardedPlayer = addSpinEnergy(addFlux(nextRuntime.player, balanceConfig.flux.killRegen), maxSpinEnergy(nextRuntime.player) * 0.14);
    nextRuntime = {
      ...nextRuntime,
      player: {
        ...rewardedPlayer,
        spinIntegrity: Math.min(rewardedPlayer.stats.maxSpinIntegrity, rewardedPlayer.spinIntegrity + rewardedPlayer.stats.maxSpinIntegrity * 0.14),
        fluxGuard: Math.min(rewardedPlayer.stats.maxFluxGuard, rewardedPlayer.fluxGuard + rewardedPlayer.stats.maxFluxGuard * 0.2),
      },
      kills: nextRuntime.kills + 1,
      wave: nextRuntime.wave + 1,
      mapKills: nextMapKills,
      mapKillTarget: routeCleared ? createMapKillTarget(nextRuntime.arenaId, nextRuntime.seed, nextRouteClears, nextRuntime.arenaKey) : nextRuntime.mapKillTarget,
      bossSpawned: routeCleared ? false : nextRuntime.bossSpawned,
      routeClears: nextRouteClears,
      routeMechanic: routeCleared ? createRouteMechanicState(nextRuntime.loadout) : nextRuntime.routeMechanic,
      routeTransitionCooldown: routeCleared ? routeTransitionCooldownSeconds : nextRuntime.routeTransitionCooldown,
      nextEnemyIn: routeCleared ? routeTransitionCooldownSeconds : nextMapKills >= nextRuntime.mapKillTarget ? 0.65 : 0.16,
    };
    if (routeCleared) {
      nextRuntime = pushEvent(nextRuntime, "reward", "Next route spooling");
    }
    if (bossNowReady) {
      nextRuntime = addEffect(pushEvent(nextRuntime, "danger", "Basin clear; Brass Judicator is entering"), {
        kind: "bossSignal",
        x: 0,
        y: 0,
        lifetime: 1.4,
        intensity: 1.3,
      });
    }
  }

  return { ...nextRuntime, enemies: survivors };
}

function classifyCollision({
  normalImpulse,
  surfaceShear,
  contactAge,
  closingSpeed,
  combinedMass,
}: {
  normalImpulse: number;
  surfaceShear: number;
  contactAge: number;
  closingSpeed: number;
  combinedMass: number;
}): TopCollisionEvent["kind"] {
  if (contactAge >= 0.16 && surfaceShear > 112) {
    return "grind";
  }
  if (normalImpulse > 142 || (combinedMass > 2.35 && normalImpulse > 104) || closingSpeed > 132) {
    return "smash";
  }
  if (surfaceShear > normalImpulse * 1.45 && surfaceShear > 124) {
    return "scrape";
  }
  return "clash";
}

function outwardFromBasin(entity: TopRuntimeEntity, fallbackX: number, fallbackY: number): { x: number; y: number } {
  const distanceFromCenter = length(entity.x, entity.y);
  if (distanceFromCenter > entity.radius * 0.4) {
    return normalize(entity.x, entity.y);
  }
  return normalize(fallbackX, fallbackY);
}

function resolveTopCollisionPhysics(
  player: TopRuntimeEntity,
  enemy: TopRuntimeEntity,
  time: number,
  index: number,
  contactAge: number,
  tuning: ArenaTuningConfig = defaultArenaTuning,
): { player: TopRuntimeEntity; enemy: TopRuntimeEntity; collision: TopCollisionEvent } {
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const distance = length(dx, dy) || 0.001;
  const collisionDistance = enemy.radius + player.radius;
  const overlap = Math.max(0, collisionDistance - distance);
  const normal = normalize(dx, dy);
  const tangent = { x: -normal.y, y: normal.x };
  const playerInvMass = 1 / Math.max(0.35, player.stats.mass);
  const enemyInvMass = 1 / Math.max(0.35, enemy.stats.mass);
  const invMassSum = playerInvMass + enemyInvMass;
  const playerCorrection = overlap * (playerInvMass / invMassSum);
  const enemyCorrection = overlap * (enemyInvMass / invMassSum);
  const playerPositioned = {
    ...player,
    x: player.x - normal.x * playerCorrection,
    y: player.y - normal.y * playerCorrection,
  };
  const enemyPositioned = {
    ...enemy,
    x: enemy.x + normal.x * enemyCorrection,
    y: enemy.y + normal.y * enemyCorrection,
  };
  const relativeVx = enemyPositioned.vx - playerPositioned.vx;
  const relativeVy = enemyPositioned.vy - playerPositioned.vy;
  const relativeNormalSpeed = relativeVx * normal.x + relativeVy * normal.y;
  const closingSpeed = Math.max(0, -relativeNormalSpeed);
  const playerSurfaceSpeed = angularSurfaceSpeed(player);
  const enemySurfaceSpeed = angularSurfaceSpeed(enemy);
  const spinShearSpeed = Math.abs(playerSurfaceSpeed) + Math.abs(enemySurfaceSpeed);
  const spinShearRatio = clamp(spinShearSpeed / 260, 0, 1.8);
  const speedRecoilRatio = clamp((closingSpeed - 42) / 210, 0, 1.65);
  const restitution = clamp(0.62 + (player.stats.edge + enemy.stats.edge) * 2.4 + (spinRatio(player) + spinRatio(enemy)) * 0.11 + speedRecoilRatio * 0.7, 0.58, 1.72);
  const normalImpulse = ((1 + restitution) * closingSpeed + overlap * 10) / invMassSum;
  const relativeTangentialSpeed = relativeVx * tangent.x + relativeVy * tangent.y - playerSurfaceSpeed - enemySurfaceSpeed;
  const surfaceShear = Math.abs(relativeTangentialSpeed) + spinShearSpeed * 0.42;
  const friction = clamp(0.24 + (player.stats.grip + enemy.stats.grip) * 0.36 + spinShearRatio * 0.16, 0.24, 1.08);
  const rawTangentImpulse = -relativeTangentialSpeed / invMassSum;
  const tangentImpulse = clamp(rawTangentImpulse, -normalImpulse * friction, normalImpulse * friction);
  const impulseX = normal.x * normalImpulse + tangent.x * tangentImpulse;
  const impulseY = normal.y * normalImpulse + tangent.y * tangentImpulse;
  const centerDistance = Math.min(length(playerPositioned.x, playerPositioned.y), length(enemyPositioned.x, enemyPositioned.y));
  const centerPocketBoost = clamp(1.62 - centerDistance / 230, 0.78, 1.62);
  const recoilEnergy = closingSpeed * 1.08 + normalImpulse * 1.06 + Math.abs(tangentImpulse) * 0.44 + spinShearSpeed * 0.1;
  const speedBurst = 1 + Math.pow(speedRecoilRatio, 1.34) * 0.46;
  const launchCap = 580 + tuning.collisionLaunchMultiplier * 780;
  const launchPower = clamp(recoilEnergy * (0.26 + speedRecoilRatio * 0.82 + spinShearRatio * 0.18) * centerPocketBoost * speedBurst * tuning.collisionLaunchMultiplier, 0, launchCap);
  const recoilSeparation = clamp(overlap * 0.58 + launchPower * 0.032, 0, 38);
  const tangentSign = Math.sign(tangentImpulse || relativeTangentialSpeed || 1);
  const playerOutward = outwardFromBasin(playerPositioned, -normal.x, -normal.y);
  const enemyOutward = outwardFromBasin(enemyPositioned, normal.x, normal.y);
  const playerLaunch = normalize(-normal.x * 1.1 + playerOutward.x * 0.7 - tangent.x * tangentSign * 0.22, -normal.y * 1.1 + playerOutward.y * 0.7 - tangent.y * tangentSign * 0.22);
  const enemyLaunch = normalize(normal.x * 1.1 + enemyOutward.x * 0.7 + tangent.x * tangentSign * 0.22, normal.y * 1.1 + enemyOutward.y * 0.7 + tangent.y * tangentSign * 0.22);
  const skid = surfaceShear / 96;
  const playerSpinLoss =
    normalImpulse * (0.018 / Math.max(0.7, player.stats.mass)) + Math.abs(tangentImpulse) * (0.032 + enemy.stats.edge * 0.04) + skid * Math.max(0.1, 1 - player.stats.grip) * 0.48;
  const enemySpinLoss =
    normalImpulse * (0.018 / Math.max(0.7, enemy.stats.mass)) + Math.abs(tangentImpulse) * (0.032 + player.stats.edge * 0.04) + skid * Math.max(0.1, 1 - enemy.stats.grip) * 0.48;
  const playerWobbleGain = clamp((normalImpulse * 0.0034 + Math.abs(tangentImpulse) * 0.006 + spinShearRatio * 0.06) / Math.max(0.8, player.stats.mass + player.stats.grip), 0, 0.65);
  const enemyWobbleGain = clamp((normalImpulse * 0.0034 + Math.abs(tangentImpulse) * 0.006 + spinShearRatio * 0.06) / Math.max(0.8, enemy.stats.mass + enemy.stats.grip), 0, 0.65);
  const sparkIntensity = clamp((surfaceShear / 84 + normalImpulse / 104 + (spinRatio(player) + spinRatio(enemy)) * 0.42) * tuning.sparkMultiplier, 0.25, 7.2);
  const kind = classifyCollision({ normalImpulse, surfaceShear, contactAge, closingSpeed, combinedMass: player.stats.mass + enemy.stats.mass });
  const heavy = kind === "smash" || normalImpulse > 66 || closingSpeed > 78 || Math.abs(tangentImpulse) > 30 || sparkIntensity > 1.8;
  const contactX = playerPositioned.x + normal.x * player.radius;
  const contactY = playerPositioned.y + normal.y * player.radius;

  return {
    player: {
      ...loseSpinPower(playerPositioned, playerSpinLoss),
      x: playerPositioned.x + playerLaunch.x * recoilSeparation,
      y: playerPositioned.y + playerLaunch.y * recoilSeparation,
      vx: playerPositioned.vx - impulseX * playerInvMass + playerLaunch.x * launchPower * clamp(playerInvMass, 0.52, 1.7),
      vy: playerPositioned.vy - impulseY * playerInvMass + playerLaunch.y * launchPower * clamp(playerInvMass, 0.52, 1.7),
      wobble: clamp(playerPositioned.wobble + playerWobbleGain, 0, 1),
    },
    enemy: {
      ...loseSpinPower(enemyPositioned, enemySpinLoss),
      x: enemyPositioned.x + enemyLaunch.x * recoilSeparation,
      y: enemyPositioned.y + enemyLaunch.y * recoilSeparation,
      vx: enemyPositioned.vx + impulseX * enemyInvMass + enemyLaunch.x * launchPower * clamp(enemyInvMass, 0.52, 1.7),
      vy: enemyPositioned.vy + impulseY * enemyInvMass + enemyLaunch.y * launchPower * clamp(enemyInvMass, 0.52, 1.7),
      wobble: clamp(enemyPositioned.wobble + enemyWobbleGain, 0, 1),
    },
    collision: {
      id: `collision_${Math.round(time * 1000)}_${index}`,
      playerId: player.id,
      enemyId: enemy.id,
      kind,
      x: contactX,
      y: contactY,
      normalX: normal.x,
      normalY: normal.y,
      tangentX: tangent.x,
      tangentY: tangent.y,
      normalImpulse,
      tangentImpulse,
      relativeNormalSpeed: closingSpeed,
      relativeTangentialSpeed,
      surfaceShear,
      sparkIntensity,
      contactAge,
      heavy,
    },
  };
}

function resolveCollisions(runtime: TopArenaRuntime, deltaSeconds: number, tuning: ArenaTuningConfig = defaultArenaTuning): TopArenaRuntime {
  let nextRuntime = runtime;
  let player = runtime.player;
  const enemies: TopRuntimeEntity[] = [];
  const collisionContacts: Record<string, number> = {};

  for (const [index, enemy] of runtime.enemies.entries()) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = length(dx, dy);
    const collisionDistance = enemy.radius + player.radius;
    let nextEnemy = enemy;

    if (distance < collisionDistance) {
      const contactAge = (runtime.collisionContacts[enemy.id] ?? 0) + deltaSeconds;
      collisionContacts[enemy.id] = contactAge;
      const resolved = resolveTopCollisionPhysics(player, nextEnemy, runtime.time, index, contactAge, tuning);
      player = resolved.player;
      nextEnemy = resolved.enemy;
      nextRuntime = { ...nextRuntime, lastCollision: resolved.collision };

      if (resolved.collision.sparkIntensity > 0.55) {
        const sparkLength = 24 + resolved.collision.surfaceShear * 0.24;
        nextRuntime = addEffect(nextRuntime, {
          kind: "frictionSpark",
          x: resolved.collision.x,
          y: resolved.collision.y,
          x2: resolved.collision.x + resolved.collision.tangentX * Math.sign(resolved.collision.tangentImpulse || 1) * sparkLength,
          y2: resolved.collision.y + resolved.collision.tangentY * Math.sign(resolved.collision.tangentImpulse || 1) * sparkLength,
          lifetime: 0.34 + Math.min(0.26, resolved.collision.sparkIntensity * 0.05),
          intensity: resolved.collision.sparkIntensity,
        });
      }

      if (resolved.collision.heavy) {
        nextRuntime = addEffect(nextRuntime, {
          kind: "shockwave",
          x: resolved.collision.x,
          y: resolved.collision.y,
          lifetime: 0.34 + Math.min(0.22, resolved.collision.sparkIntensity * 0.025),
          intensity: clamp(resolved.collision.sparkIntensity * 0.34 + resolved.collision.normalImpulse / 260, 0.85, 2.9),
        });
      }

      const playerHit = dealDamage(nextRuntime, player, nextEnemy, "collision", resolved.collision);
      nextRuntime = playerHit.runtime;
      nextEnemy = playerHit.defender;

      const enemyHit = dealDamage(nextRuntime, nextEnemy, player, "collision", resolved.collision);
      nextRuntime = enemyHit.runtime;
      player = enemyHit.defender;

      if (resolved.collision.heavy) {
        nextRuntime = pushEvent(nextRuntime, "hit", `${resolved.collision.kind.toUpperCase()} impulse ${Math.round(resolved.collision.normalImpulse)}`);
      }
    }

    enemies.push(nextEnemy);
  }

  return { ...nextRuntime, player, enemies, collisionContacts };
}

function resolveEnemyCrowdPhysics(runtime: TopArenaRuntime, tuning: ArenaTuningConfig = defaultArenaTuning): TopArenaRuntime {
  if (runtime.enemies.length < 2) {
    return runtime;
  }

  let nextRuntime = runtime;
  const enemies = runtime.enemies.map((enemy) => ({ ...enemy }));
  let visualEffectBudget = 8;

  for (let leftIndex = 0; leftIndex < enemies.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < enemies.length; rightIndex += 1) {
      const left = enemies[leftIndex];
      const right = enemies[rightIndex];
      const dx = right.x - left.x;
      const dy = right.y - left.y;
      const distance = length(dx, dy);
      const fallbackAngle = (leftIndex * 1.9 + rightIndex * 2.7 + runtime.time) % (Math.PI * 2);
      const normal = distance > 0.001 ? { x: dx / distance, y: dy / distance } : { x: Math.cos(fallbackAngle), y: Math.sin(fallbackAngle) };
      const tangent = { x: -normal.y, y: normal.x };
      const collisionDistance = left.radius + right.radius;
      const overlap = collisionDistance - distance;

      if (overlap <= 0) {
        continue;
      }

      const leftInvMass = 1 / Math.max(0.45, left.stats.mass);
      const rightInvMass = 1 / Math.max(0.45, right.stats.mass);
      const invMassSum = leftInvMass + rightInvMass;
      const pressure = clamp(0.72 + tuning.activeEnemyPressure * 0.16, 0.72, 1.06);
      const leftCorrection = overlap * pressure * (leftInvMass / invMassSum);
      const rightCorrection = overlap * pressure * (rightInvMass / invMassSum);
      const relativeVx = right.vx - left.vx;
      const relativeVy = right.vy - left.vy;
      const relativeNormalSpeed = relativeVx * normal.x + relativeVy * normal.y;
      const closingSpeed = Math.max(0, -relativeNormalSpeed);
      const leftSurfaceSpeed = angularSurfaceSpeed(left);
      const rightSurfaceSpeed = angularSurfaceSpeed(right);
      const spinShearSpeed = Math.abs(leftSurfaceSpeed) + Math.abs(rightSurfaceSpeed);
      const spinShearRatio = clamp(spinShearSpeed / 280, 0, 1.6);
      const restitution = clamp(0.42 + (left.stats.edge + right.stats.edge) * 1.8 + (spinRatio(left) + spinRatio(right)) * 0.07 + closingSpeed / 340, 0.42, 1.18);
      const normalImpulse = ((1 + restitution) * closingSpeed + overlap * 8.2) / invMassSum;
      const relativeTangentialSpeed = relativeVx * tangent.x + relativeVy * tangent.y - leftSurfaceSpeed - rightSurfaceSpeed;
      const surfaceShear = Math.abs(relativeTangentialSpeed) + spinShearSpeed * 0.34;
      const friction = clamp(0.18 + (left.stats.grip + right.stats.grip) * 0.22 + spinShearRatio * 0.1, 0.18, 0.72);
      const rawTangentImpulse = -relativeTangentialSpeed / invMassSum;
      const tangentImpulse = clamp(rawTangentImpulse, -normalImpulse * friction, normalImpulse * friction);
      const impulseX = normal.x * normalImpulse + tangent.x * tangentImpulse;
      const impulseY = normal.y * normalImpulse + tangent.y * tangentImpulse;
      const tangentSign = Math.sign(tangentImpulse || relativeTangentialSpeed || 1);
      const leftOutward = outwardFromBasin(left, -normal.x, -normal.y);
      const rightOutward = outwardFromBasin(right, normal.x, normal.y);
      const leftLaunch = normalize(-normal.x * 1.05 + leftOutward.x * 0.32 - tangent.x * tangentSign * 0.14, -normal.y * 1.05 + leftOutward.y * 0.32 - tangent.y * tangentSign * 0.14);
      const rightLaunch = normalize(normal.x * 1.05 + rightOutward.x * 0.32 + tangent.x * tangentSign * 0.14, normal.y * 1.05 + rightOutward.y * 0.32 + tangent.y * tangentSign * 0.14);
      const launchPower = clamp((normalImpulse * 0.46 + closingSpeed * 0.82 + Math.abs(tangentImpulse) * 0.26 + spinShearSpeed * 0.035) * tuning.collisionLaunchMultiplier, 0, 420);
      const recoilSeparation = clamp(overlap * 0.44 + launchPower * 0.012, 0, 16);
      const skid = surfaceShear / 110;
      const leftSpinLoss = normalImpulse * (0.007 / Math.max(0.75, left.stats.mass)) + Math.abs(tangentImpulse) * 0.012 + skid * Math.max(0.12, 1 - left.stats.grip) * 0.18;
      const rightSpinLoss = normalImpulse * (0.007 / Math.max(0.75, right.stats.mass)) + Math.abs(tangentImpulse) * 0.012 + skid * Math.max(0.12, 1 - right.stats.grip) * 0.18;
      const leftWobbleGain = clamp((normalImpulse * 0.0018 + Math.abs(tangentImpulse) * 0.0034 + overlap * 0.004) / Math.max(0.8, left.stats.mass + left.stats.grip), 0, 0.34);
      const rightWobbleGain = clamp((normalImpulse * 0.0018 + Math.abs(tangentImpulse) * 0.0034 + overlap * 0.004) / Math.max(0.8, right.stats.mass + right.stats.grip), 0, 0.34);

      enemies[leftIndex] = {
        ...loseSpinPower(left, leftSpinLoss),
        x: left.x - normal.x * leftCorrection + leftLaunch.x * recoilSeparation,
        y: left.y - normal.y * leftCorrection + leftLaunch.y * recoilSeparation,
        vx: left.vx - impulseX * leftInvMass + leftLaunch.x * launchPower * clamp(leftInvMass, 0.42, 1.55),
        vy: left.vy - impulseY * leftInvMass + leftLaunch.y * launchPower * clamp(leftInvMass, 0.42, 1.55),
        wobble: clamp(left.wobble + leftWobbleGain, 0, 1),
      };
      enemies[rightIndex] = {
        ...loseSpinPower(right, rightSpinLoss),
        x: right.x + normal.x * rightCorrection + rightLaunch.x * recoilSeparation,
        y: right.y + normal.y * rightCorrection + rightLaunch.y * recoilSeparation,
        vx: right.vx + impulseX * rightInvMass + rightLaunch.x * launchPower * clamp(rightInvMass, 0.42, 1.55),
        vy: right.vy + impulseY * rightInvMass + rightLaunch.y * launchPower * clamp(rightInvMass, 0.42, 1.55),
        wobble: clamp(right.wobble + rightWobbleGain, 0, 1),
      };

      const sparkIntensity = clamp((surfaceShear / 150 + normalImpulse / 180 + overlap / 32) * tuning.sparkMultiplier, 0.3, 2.3);
      if (visualEffectBudget > 0 && (closingSpeed > 26 || surfaceShear > 95 || overlap > 5)) {
        const contactX = left.x + normal.x * left.radius;
        const contactY = left.y + normal.y * left.radius;
        const sparkLength = 14 + surfaceShear * 0.09 + closingSpeed * 0.08;
        nextRuntime = addEffect(nextRuntime, {
          kind: "frictionSpark",
          x: contactX,
          y: contactY,
          x2: contactX + tangent.x * Math.sign(tangentImpulse || 1) * sparkLength,
          y2: contactY + tangent.y * Math.sign(tangentImpulse || 1) * sparkLength,
          lifetime: 0.18 + Math.min(0.18, sparkIntensity * 0.05),
          intensity: sparkIntensity,
        });
        visualEffectBudget -= 1;
      }

      if (visualEffectBudget > 0 && (closingSpeed > 92 || normalImpulse > 96)) {
        nextRuntime = addEffect(nextRuntime, {
          kind: "shockwave",
          x: (left.x + right.x) / 2,
          y: (left.y + right.y) / 2,
          lifetime: 0.26,
          intensity: clamp(sparkIntensity * 0.58 + normalImpulse / 320, 0.55, 1.65),
        });
        visualEffectBudget -= 1;
      }

      if (hasEquippedBase(runtime, "part_ring_storm_orbit") && visualEffectBudget > 0 && (closingSpeed > 70 || normalImpulse > 78 || surfaceShear > 130)) {
        nextRuntime = addEffect(nextRuntime, {
          kind: "stormArc",
          x: left.x,
          y: left.y,
          x2: right.x,
          y2: right.y,
          lifetime: 0.32,
          intensity: clamp(sparkIntensity * 0.54 + surfaceShear / 260, 0.7, 2),
        });
        visualEffectBudget -= 1;
      }
    }
  }

  return { ...nextRuntime, enemies };
}

function resolvePlayerSkill(runtime: TopArenaRuntime): TopArenaRuntime {
  const drive = getDriveCoreDef(runtime.driveId);
  const runeBehaviors = activeRuneBehaviors(runtime);
  const runeValidation = validateRuneLoadout(runtime.driveId, runtime.loadout.runeIds ?? []);
  const collisionTarget = runtime.lastCollision ? runtime.enemies.find((enemy) => enemy.id === runtime.lastCollision?.enemyId) : undefined;
  const collisionReady = Boolean(collisionTarget && runtime.lastCollision);
  const collisionKind = runtime.lastCollision?.kind;
  const collisionDriven =
    collisionReady &&
    (drive.id === "drive_shard_barrage" ||
      (drive.id === "drive_ember_scour" && (collisionKind === "scrape" || collisionKind === "grind")) ||
      (drive.id === "drive_molten_groove" && collisionKind === "grind") ||
      (drive.id === "drive_storm_lattice" && (runtime.lastCollision?.sparkIntensity ?? 0) > 1.7) ||
      (drive.id === "drive_chain_tempest" && Boolean(runtime.lastCollision?.heavy)));
  const target = drive.trigger === "onCollision" || drive.trigger === "onHeavyCollision" || collisionDriven ? collisionTarget : runtime.enemies[0];
  if (!target || runtime.player.cooldownRemaining > 0) {
    return runtime;
  }

  const distanceToTarget = length(target.x - runtime.player.x, target.y - runtime.player.y);
  const projectileAssist = drive.tags.includes("projectile") && distanceToTarget < runtime.player.radius + target.radius + 170;
  const heavyCollisionReady = Boolean(collisionTarget && (runtime.lastCollision?.heavy || runtime.lastCollision?.kind === "smash"));
  const triggerReady =
    drive.trigger === "onCooldown" ||
    projectileAssist ||
    (drive.trigger === "onEnemyEnterRadius" && distanceToTarget < runtime.player.radius + target.radius + 130) ||
    (drive.trigger === "onCollision" && collisionReady) ||
    (drive.trigger === "onHeavyCollision" && heavyCollisionReady) ||
    collisionDriven;

  if (!triggerReady) {
    return runtime;
  }

  const collisionDamageContext = drive.trigger === "onCollision" || drive.trigger === "onHeavyCollision" || collisionDriven ? runtime.lastCollision : undefined;
  const driveFluxCost = (drive.cost?.amount ?? 0) * runeValidation.costMultiplier;
  if (currentFlux(runtime.player) < driveFluxCost) {
    return runtime;
  }
  let enemies = runtime.enemies;
  let nextRuntime = { ...runtime, player: spendFlux(runtime.player, driveFluxCost) };
  const hitEnemyIds = new Set<string>();
  const applyPlayerSkillHit = (enemy: TopRuntimeEntity, scalar: number) => {
    const skillHit = dealDamage(nextRuntime, nextRuntime.player, enemy, "skill", collisionDamageContext, scalar);
    nextRuntime = skillHit.runtime;
    enemies = enemies.map((entry) => (entry.id === enemy.id ? skillHit.defender : entry));
    hitEnemyIds.add(enemy.id);
    return skillHit.defender;
  };

  const primaryDefender = applyPlayerSkillHit(target, 1);

  if (behaviorCount(runeBehaviors, "repeat") > 0 && primaryDefender.spinIntegrity > 0) {
    applyPlayerSkillHit(primaryDefender, 0.44 + behaviorCount(runeBehaviors, "repeat") * 0.08);
  }

  const extraProjectileCount = drive.tags.includes("projectile") ? behaviorCount(runeBehaviors, "projectileCount") : 0;
  if (extraProjectileCount > 0) {
    const projectileTargets = enemies
      .filter((enemy) => enemy.spinIntegrity > 0 && !hitEnemyIds.has(enemy.id))
      .sort((left, right) => length(left.x - runtime.player.x, left.y - runtime.player.y) - length(right.x - runtime.player.x, right.y - runtime.player.y))
      .slice(0, Math.min(2, extraProjectileCount + 1));

    for (const enemy of projectileTargets) {
      applyPlayerSkillHit(enemy, 0.52);
    }
  }

  const chainCount = drive.tags.includes("chain") ? behaviorCount(runeBehaviors, "chain") : 0;
  if (chainCount > 0) {
    const chainTargets = enemies
      .filter((enemy) => enemy.spinIntegrity > 0 && !hitEnemyIds.has(enemy.id))
      .sort((left, right) => length(left.x - target.x, left.y - target.y) - length(right.x - target.x, right.y - target.y))
      .slice(0, Math.min(2, chainCount + 1));

    for (const enemy of chainTargets) {
      applyPlayerSkillHit(enemy, 0.48);
    }
  }

  if (behaviorCount(runeBehaviors, "area") > 0) {
    const areaRadius = 112 + behaviorCount(runeBehaviors, "area") * 24;
    const splashTargets = enemies.filter((enemy) => enemy.spinIntegrity > 0 && !hitEnemyIds.has(enemy.id) && length(enemy.x - target.x, enemy.y - target.y) <= areaRadius).slice(0, 4);
    for (const enemy of splashTargets) {
      applyPlayerSkillHit(enemy, 0.36);
    }
    if (splashTargets.length > 0) {
      nextRuntime = addEffect(nextRuntime, {
        kind: drive.visual === "emberTrail" ? "emberTrail" : "shockwave",
        x: target.x,
        y: target.y,
        lifetime: 0.48,
        intensity: clamp(splashTargets.length * 0.42, 0.65, 1.8),
      });
    }
  }

  if (behaviorCount(runeBehaviors, "risk") > 0) {
    nextRuntime = damagePlayer(nextRuntime, nextRuntime.player.stats.maxSpinIntegrity * 0.004 * behaviorCount(runeBehaviors, "risk"));
  }

  if (runtime.lastCollision && (drive.id === "drive_molten_groove" || (drive.id === "drive_ember_scour" && runtime.lastCollision.kind === "grind"))) {
    nextRuntime = addEffect(nextRuntime, {
      kind: "hazard",
      x: runtime.lastCollision.x,
      y: runtime.lastCollision.y,
      lifetime: drive.id === "drive_molten_groove" ? 2.6 : 1.8,
      intensity: drive.id === "drive_molten_groove" ? 1.25 + Math.min(1.4, runtime.lastCollision.contactAge * 2.2) : 0.85 + Math.min(1, runtime.lastCollision.sparkIntensity * 0.2),
    });
  }

  const cooldownPressure =
    runeValidation.costMultiplier +
    behaviorCount(runeBehaviors, "repeat") * 0.08 +
    behaviorCount(runeBehaviors, "projectileCount") * 0.06 +
    behaviorCount(runeBehaviors, "chain") * 0.05 -
    behaviorCount(runeBehaviors, "trigger") * 0.08;

  return {
    ...nextRuntime,
    player: { ...nextRuntime.player, cooldownRemaining: (drive.baseCooldown * Math.max(0.65, cooldownPressure)) / Math.max(0.35, nextRuntime.player.stats.resonance) },
    enemies,
  };
}

function recoverPlayer(player: TopRuntimeEntity, deltaSeconds: number): TopRuntimeEntity {
  const integrityRecovery = player.stats.maxSpinIntegrity * 0.025 * deltaSeconds * player.stats.resonance;
  const guardRecovery = player.stats.maxFluxGuard * 0.04 * deltaSeconds * player.stats.resonance;
  const fluxRecovery = balanceConfig.flux.naturalRegenPerSecond * deltaSeconds * Math.max(0.35, player.stats.resonance + (player.stats.reservationEfficiency ?? 0));
  const recoveredFlux = addFlux(player, fluxRecovery);
  const recoveredEnergy = addSpinEnergy(recoveredFlux, maxSpinEnergy(recoveredFlux) * 0.025 * deltaSeconds * recoveredFlux.stats.resonance);
  const stabilizedEnergy = withSpinEnergy(recoveredEnergy, Math.max(currentSpinEnergy(recoveredEnergy), maxSpinEnergy(recoveredEnergy) * 0.04));

  return {
    ...stabilizedEnergy,
    spinIntegrity: Math.min(stabilizedEnergy.stats.maxSpinIntegrity, Math.max(stabilizedEnergy.spinIntegrity, stabilizedEnergy.stats.maxSpinIntegrity * 0.04) + integrityRecovery),
    fluxGuard: Math.min(stabilizedEnergy.stats.maxFluxGuard, stabilizedEnergy.fluxGuard + guardRecovery),
  };
}

export function stepTopArenaRuntime(runtime: TopArenaRuntime, deltaSeconds: number, tuningOverrides?: Partial<ArenaTuningConfig>): TopArenaRuntime {
  const arena = getArenaCircuitDef(runtime.arenaId);
  const tuning = normalizeArenaTuning(tuningOverrides);
  let nextRuntime: TopArenaRuntime = {
    ...runtime,
    time: runtime.time + deltaSeconds,
    player: recoverPlayer(runtime.player, deltaSeconds),
    nextEnemyIn: Math.max(0, runtime.nextEnemyIn - deltaSeconds),
    routeTransitionCooldown: Math.max(0, runtime.routeTransitionCooldown - deltaSeconds),
    effects: runtime.effects
      .map((effect) => ({ ...effect, age: effect.age + deltaSeconds }))
      .filter((effect) => effect.age < effect.lifetime),
    drops: runtime.drops.map((drop) => ({ ...drop, age: drop.age + deltaSeconds })).slice(0, maxDrops),
    lastCollision: undefined,
  };
  nextRuntime = tickRouteMechanic(nextRuntime, deltaSeconds);

  if (nextRuntime.nextEnemyIn <= 0 && nextRuntime.routeTransitionCooldown <= 0) {
    const bossReady = nextRuntime.mapKills >= nextRuntime.mapKillTarget;
    const smallEnemies = activeSmallEnemyCount(nextRuntime);
    const bossEnemy = nextRuntime.enemies.find((enemy) => enemy.rank === "boss");
    if (bossReady && !nextRuntime.bossSpawned && nextRuntime.enemies.length === 0) {
      nextRuntime = spawnEnemy(nextRuntime, "boss", tuning);
    } else if (!bossReady && !bossEnemy && smallEnemies < desiredSmallEnemyCount(nextRuntime, tuning)) {
      nextRuntime = spawnEnemy(nextRuntime, undefined, tuning);
    }
  }

  const firstEnemy = nextRuntime.enemies[0] ?? null;
  const player = steerEntity(nextRuntime.player, firstEnemy, arena.radius, deltaSeconds, tuning);
  const enemies = nextRuntime.enemies.map((enemy) => steerEntity(enemy, player, arena.radius, deltaSeconds, tuning));
  nextRuntime = { ...nextRuntime, player, enemies };
  nextRuntime = resolveEnemyCrowdPhysics(nextRuntime, tuning);
  nextRuntime = resolveEnemySkills(nextRuntime);
  nextRuntime = resolveHazards(nextRuntime, deltaSeconds);
  nextRuntime = resolveCollisions(nextRuntime, deltaSeconds, tuning);
  nextRuntime = resolvePlayerSkill(nextRuntime);
  nextRuntime = handleKills(nextRuntime);

  return nextRuntime;
}
