import { getArenaCircuitDef } from "../data/arenaCircuits";
import { getArenaAnomalyDef } from "../data/arenaAnomalies";
import { arenaEvents } from "../data/arenaEvents";
import { balanceConfig } from "../data/balanceConfig";
import { resolveCircuitAtlasBonuses } from "../data/circuitAtlasNodes";
import { resolveDoctrineBonuses } from "../data/doctrines";
import { getDriveCoreDef } from "../data/driveCores";
import { enemyModifiers } from "../data/enemyModifiers";
import { getNamedRivalDef } from "../data/namedRivals";
import { getTopFrameDef } from "../data/topFrames";
import { getTopPartBaseDef } from "../data/topParts";
import { getTuningRuneDef } from "../data/tuningRunes";
import { summarizeArenaKeyRiskReward } from "./arenaKeys";
import { evaluateCombatCondition, type CombatContext } from "./conditionEval";
import { evaluateDriveGate } from "./driveGate";
import { validateRuneLoadout } from "./driveRuneValidation";
import { clamp } from "./math";
import { collisionImpactSeedFromMass, effectiveCooldownFromOmega, resolveStatsPhysics } from "./topPhysics";
import { createRng } from "./rng";
import { resolveTopRuntimeStats } from "./topAssembly";
import { resolveTopHit } from "./topDamage";
import { rollDropOutcome } from "./topDropRolls";
import type {
  AilmentState,
  ArenaDrop,
  ArenaEffect,
  ArenaAnomalyRule,
  ArenaEventState,
  ArenaKey,
  ArenaLogEvent,
  ArenaTuningConfig,
  CombatEvent,
  EnemyBehaviorId,
  EnemyModifierDef,
  NamedRivalDef,
  RivalMechanicId,
  TopArenaDefeatCause,
  TopArenaRuntime,
  TopCollisionEvent,
  TopDamageType,
  TopLoadoutConfig,
  TopRuntimeEntity,
  TopRuntimeStats,
  TuningRuneDef,
} from "./topTypes";
import { emptyDamagePacket, zeroResistances } from "./topTypes";

const maxEvents = 8;
const maxCombatEvents = 16;
const maxEffects = 80;
const maxDrops = 12;
const minMapKillTarget = 150;
const maxMapKillTarget = 200;
const maxActiveSmallEnemies = 20;
const bossPhaseTwoGateRatio = 0.66;
const bossPhaseThreeGateRatio = 0.33;
const bossPhaseGateCooldownSeconds = 1.35;
const routeTransitionCooldownSeconds = 4.5;
const rivalBossDurabilityScalar = 2.2;

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

function hasArenaAnomalyRule(loadout: TopLoadoutConfig | undefined, rule: ArenaAnomalyRule): boolean {
  const anomaly = loadout?.anomalyId ? getArenaAnomalyDef(loadout.anomalyId) : null;
  return anomaly?.playerRule === rule;
}

function behaviorCount(behaviors: ActiveRuneBehaviors, behavior: NonNullable<TuningRuneDef["behavior"]>): number {
  return behaviors[behavior] ?? 0;
}

function hasEquippedBase(runtime: Pick<TopArenaRuntime, "loadout">, baseId: string): boolean {
  return Object.values(runtime.loadout.equipment ?? {}).some((part) => part?.baseId === baseId);
}

function hasDoctrineRule(runtime: Pick<TopArenaRuntime, "loadout">, rule: ReturnType<typeof resolveDoctrineBonuses>["rules"][number]): boolean {
  return resolveDoctrineBonuses(runtime.loadout.doctrineId).rules.includes(rule);
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

export function collisionSpinEnergyLoss(entity: TopRuntimeEntity, normalImpulse: number): number {
  const physics = resolveStatsPhysics(entity.stats, { spinEnergy: currentSpinEnergy(entity) });
  return (Math.max(0, normalImpulse) / Math.max(0.1, physics.designMass)) * balanceConfig.energy.collisionLossScalar;
}

function drainCollisionSpinEnergy(entity: TopRuntimeEntity, normalImpulse: number): TopRuntimeEntity {
  return drainSpinEnergy(entity, collisionSpinEnergyLoss(entity, normalImpulse));
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

function createCombatContext(entity: TopRuntimeEntity, events: CombatEvent[] = []): CombatContext {
  const physics = resolveStatsPhysics(entity.stats, { spinEnergy: currentSpinEnergy(entity) });
  return {
    physics,
    spinEnergyRatio: spinEnergyRatio(entity),
    fluxRatio: clamp(currentFlux(entity) / maxFlux(entity), 0, 1.2),
    omega: physics.omega,
    events,
  };
}

function sustainSpinEnergyFromFlux(entity: TopRuntimeEntity, deltaSeconds: number): TopRuntimeEntity {
  const physics = resolveStatsPhysics(entity.stats, { spinEnergy: currentSpinEnergy(entity) });
  if (currentFlux(entity) <= physics.fluxLowThreshold) {
    return entity;
  }

  const missingEnergy = Math.max(0, maxSpinEnergy(entity) - currentSpinEnergy(entity));
  if (missingEnergy <= 0 || currentFlux(entity) <= 0) {
    return entity;
  }

  const maxFluxSpend = balanceConfig.flux.energySustainConversionPerSecond * deltaSeconds;
  const fluxNeeded = missingEnergy / balanceConfig.flux.fluxToEnergyRate;
  const fluxSpent = Math.min(currentFlux(entity), maxFluxSpend, fluxNeeded);
  if (fluxSpent <= 0) {
    return entity;
  }

  return addSpinEnergy(spendFlux(entity, fluxSpent), fluxSpent * balanceConfig.flux.fluxToEnergyRate);
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

function emitCombatEvent(runtime: TopArenaRuntime, event: CombatEvent): TopArenaRuntime {
  return {
    ...runtime,
    combatEvents: [event, ...runtime.combatEvents].slice(0, maxCombatEvents),
  };
}

function defeatText(cause: TopArenaDefeatCause): string {
  if (cause === "spinout") {
    return "Spin-out: E reached zero";
  }
  if (cause === "break") {
    return "Break: structure failed";
  }
  return "Ring-out: left the basin";
}

function defeatCauseForPlayer(runtime: TopArenaRuntime): TopArenaDefeatCause | null {
  if (runtime.combatEvents.some((event) => event.kind === "ringout" && event.sourceId === runtime.player.id)) {
    return "ringout";
  }
  if (currentSpinEnergy(runtime.player) <= balanceConfig.defeat.spinEnergyEpsilon) {
    return "spinout";
  }
  if (runtime.player.spinIntegrity <= balanceConfig.defeat.spinIntegrityEpsilon) {
    return "break";
  }
  return null;
}

function resolvePlayerDefeat(runtime: TopArenaRuntime): TopArenaRuntime {
  if (runtime.outcome !== "ongoing") {
    return runtime;
  }
  const cause = defeatCauseForPlayer(runtime);
  if (!cause) {
    return runtime;
  }
  return pushEvent(
    {
      ...runtime,
      outcome: "defeat",
      defeatCause: cause,
      player: {
        ...runtime.player,
        spinEnergy: Math.max(0, currentSpinEnergy(runtime.player)),
        spinPower: Math.max(0, runtime.player.spinPower),
        spinIntegrity: Math.max(0, runtime.player.spinIntegrity),
        cooldownRemaining: 0,
      },
    },
    "danger",
    defeatText(cause),
  );
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
  const anomaly = loadout.anomalyId ? getArenaAnomalyDef(loadout.anomalyId) : null;
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
      atlasBonuses.enemyIntegrityMultiplier *
      (anomaly?.enemyIntegrityMultiplier ?? 1),
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
      atlasBonuses.enemyImpactMultiplier *
      (anomaly?.enemyImpactMultiplier ?? 1),
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

function createRivalBossStats(rival: NamedRivalDef): TopRuntimeStats {
  const resolvedStats = resolveTopRuntimeStats(rival.frameId, rival.driveId, rival.loadout);
  const durabilityScalar = rivalBossDurabilityScalar * (rival.integrityScalar ?? 1);

  return {
    ...resolvedStats,
    maxSpinIntegrity: resolvedStats.maxSpinIntegrity * durabilityScalar,
    maxFluxGuard: resolvedStats.maxFluxGuard * Math.sqrt(durabilityScalar),
    guard: resolvedStats.guard * 1.15,
    partQuantity: 0,
    partRarity: 0,
  };
}

function mapProgressRatio(runtime: Pick<TopArenaRuntime, "mapKills" | "mapKillTarget">): number {
  return clamp(runtime.mapKills / Math.max(1, runtime.mapKillTarget), 0, 1);
}

function activeSmallEnemyCount(runtime: TopArenaRuntime): number {
  return runtime.enemies.filter((enemy) => enemy.rank !== "boss").length;
}

function desiredSmallEnemyCount(runtime: TopArenaRuntime, tuning: ArenaTuningConfig = defaultArenaTuning): number {
  if (runtime.mode === "duel") {
    return 0;
  }
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

function arenaRadiusForRuntime(runtime: Pick<TopArenaRuntime, "arenaId" | "mode" | "loadout">): number {
  const arena = getArenaCircuitDef(runtime.arenaId);
  const modeScalar = runtime.mode === "duel" ? 0.6 : 1;
  const anomalyScalar = hasArenaAnomalyRule(runtime.loadout, "shrinkingArena") ? balanceConfig.anomaly.shrinkingArenaRadiusScalar : 1;
  return arena.radius * modeScalar * anomalyScalar;
}

function spawnEnemy(runtime: TopArenaRuntime, rankOverride?: TopRuntimeEntity["rank"], tuning: ArenaTuningConfig = defaultArenaTuning): TopArenaRuntime {
  const arenaRadius = arenaRadiusForRuntime(runtime);
  const spawnIndex = runtime.spawnIndex + 1;
  const rng = createRng(`${runtime.seed}_${runtime.routeClears}_${runtime.mapKills}_${spawnIndex}`);
  const angle = rng.next() * Math.PI * 2;
  const rank = rankOverride ?? smallEnemyRankForSpawn(runtime, rng);
  const radius = rank === "boss" ? 38 : rank === "elite" ? 27 : 20;
  const difficultyWave = difficultyWaveForRuntime(runtime);
  const rival = rank === "boss" && runtime.mode === "duel" && runtime.rivalId ? getNamedRivalDef(runtime.rivalId) : undefined;
  const modifier = rival ? undefined : chooseEnemyModifier(runtime.arenaId, spawnIndex, runtime.seed);
  const behaviorId = rank === "boss" ? "bossJudicator" : behaviorForEnemy(rank, modifier!);
  const baseStats = rival ? createRivalBossStats(rival) : createEnemyStats(runtime.arenaId, rank, difficultyWave, runtime.arenaKey, runtime.activeEvent, modifier, runtime.loadout);
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
  const distance = arenaRadius * (rank === "boss" ? 0.5 + rng.next() * 0.08 : 0.72 + rng.next() * 0.19);
  const baseName = rival?.displayName ?? (rank === "boss" ? "Brass Judicator" : rank === "elite" ? "Scored Iron Rival" : "Cinder Runner");
  const enemy: TopRuntimeEntity = {
    id: `enemy_${spawnIndex}_${rank}`,
    team: "enemy",
    name: modifier ? `${modifier.displayName} ${baseName}` : baseName,
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
    driveId: rival?.driveId,
    rivalId: rival?.id,
    rivalMechanicId: rival?.mechanicId,
    enemyModifier: modifier
      ? {
          modifierId: modifier.id,
          displayName: modifier.displayName,
          rewardQuantity: modifier.rewardQuantity ?? 0,
          rewardRarity: modifier.rewardRarity ?? 0,
        }
      : undefined,
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
  const launcherBaseId = loadout.equipment?.launcher?.baseId;
  const launcherProfile = launcherBaseId ? getTopPartBaseDef(launcherBaseId).launcherProfile : undefined;
  const initialSpeedScalar = launcherProfile?.initialSpeedScalar ?? 1;
  const initialEnergyScalar = 1 + (launcherProfile?.initialEnergyBonus ?? 0);

  return {
    id: "player_top",
    team: "player",
    name: frame.displayName,
    rank: "player",
    x: 0,
    y: 0,
    vx: 32 * initialSpeedScalar,
    vy: -18 * initialSpeedScalar,
    radius: 26,
    angle: 0,
    spinIntegrity: stats.maxSpinIntegrity,
    fluxGuard: stats.maxFluxGuard,
    spinPower: 100 * initialEnergyScalar,
    maxSpinEnergy: physics.spinEnergy,
    spinEnergy: physics.spinEnergy * initialEnergyScalar,
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
  mode = "route",
  rivalId,
}: {
  arenaId: string;
  frameId: string;
  driveId: string;
  loadout?: TopLoadoutConfig;
  seed?: string;
  arenaKey?: ArenaKey;
  mode?: TopArenaRuntime["mode"];
  rivalId?: string;
}): TopArenaRuntime {
  const rival = mode === "duel" && rivalId ? getNamedRivalDef(rivalId) : undefined;
  const activeEvent = mode === "duel" ? undefined : createArenaEventState(arenaId, seed, arenaKey);
  const routeMechanic = mode === "duel" ? undefined : createRouteMechanicState(loadout);
  const initialEvents: ArenaLogEvent[] = [
    ...(activeEvent ? [{ id: "top_event_event", tone: "danger" as const, text: `${activeEvent.displayName}: ${activeEvent.logText}` }] : []),
    ...(routeMechanic ? [{ id: "top_event_route", tone: "reward" as const, text: `${routeMechanic.displayName} opened; shatter rivals before it collapses` }] : []),
    ...(mode === "duel" ? [{ id: "top_event_duel", tone: "danger" as const, text: `Duel Gate armed; shatter ${rival?.displayName ?? "the Brass Judicator"}` }] : []),
    { id: "top_event_0", tone: "reward" as const, text: "Arena coil is armed" },
  ].slice(0, maxEvents);
  const mapKillTarget = mode === "duel" ? 1 : createMapKillTarget(arenaId, seed, 0, arenaKey);

  return {
    seed,
    arenaId,
    mode,
    rivalId: rival?.id,
    arenaKey,
    activeEvent,
    routeMechanic,
    frameId,
    driveId,
    loadout,
    time: 0,
    outcome: "ongoing",
    wave: 1,
    kills: 0,
    mapKills: 0,
    mapKillTarget,
    bossSpawned: false,
    spawnIndex: 0,
    routeClears: 0,
    nextEnemyIn: mode === "duel" ? 0 : 0.2,
    routeTransitionCooldown: 0,
    eventIndex: 0,
    player: createPlayer(frameId, driveId, loadout, activeEvent),
    enemies: [],
    effects: [],
    drops: [],
    events: initialEvents,
    combatEvents: [],
    lastCollision: undefined,
    collisionContacts: {},
  };
}

type SteerEntityResult = {
  entity: TopRuntimeEntity;
  combatEvent?: CombatEvent;
};

function steerEntity(
  entity: TopRuntimeEntity,
  target: TopRuntimeEntity | null,
  arenaRadius: number,
  deltaSeconds: number,
  tuning: ArenaTuningConfig = defaultArenaTuning,
  ringoutGateScalar = 1,
): SteerEntityResult {
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
  let combatEvent: CombatEvent | undefined;

  if (distanceFromCenter + entity.radius > arenaRadius) {
    const normal = normalize(x, y);
    x = normal.x * (arenaRadius - entity.radius);
    y = normal.y * (arenaRadius - entity.radius);
    const dot = vx * normal.x + vy * normal.y;
    const physics = resolveStatsPhysics(entity.stats, { spinEnergy: currentSpinEnergy(entity) });
    const wallImpact = Math.max(0, dot);
    const ringoutGate = Math.max(balanceConfig.defeat.ringoutMinImpact * ringoutGateScalar, physics.designMass * Math.max(0.2, entity.stats.grip) * balanceConfig.defeat.ringoutGripMassScalar * ringoutGateScalar);
    if (wallImpact >= ringoutGate) {
      combatEvent = {
        kind: "ringout",
        sourceId: entity.id,
        magnitude: wallImpact,
        x,
        y,
      };
    }
    vx = (vx - 2 * dot * normal.x) * (0.55 + entity.stats.grip * 0.22);
    vy = (vy - 2 * dot * normal.y) * (0.55 + entity.stats.grip * 0.22);
    speed = length(vx, vy);
  }

  const physics = resolveStatsPhysics(entity.stats, { spinEnergy: currentSpinEnergy(entity) });
  const frictionDrain = balanceConfig.energy.frictionLossPerMassPerSecond * physics.designMass * deltaSeconds;
  const spinState = drainSpinEnergy(entity, frictionDrain);
  const wobbleRecovery = Math.max(0, entity.wobble - (0.28 + entity.stats.grip * 0.18) * deltaSeconds);

  return {
    entity: {
      ...spinState,
      x,
      y,
      vx,
      vy,
      angle: entity.angle + entity.stats.rpm * spinRatio(entity) * deltaSeconds * 4.5,
      wobble: wobbleRecovery,
      cooldownRemaining: Math.max(0, entity.cooldownRemaining - deltaSeconds),
      phaseGateCooldown: entity.phaseGateCooldown === undefined ? undefined : Math.max(0, entity.phaseGateCooldown - deltaSeconds),
    },
    combatEvent,
  };
}

type CollisionDamageContext = Pick<TopCollisionEvent, "kind" | "normalImpulse" | "tangentImpulse" | "relativeNormalSpeed" | "relativeTangentialSpeed" | "surfaceShear" | "sparkIntensity" | "contactAge" | "heavy">;

function collisionMatchesTrigger(trigger: ReturnType<typeof getDriveCoreDef>["collisionTrigger"], collision?: CollisionDamageContext): boolean {
  if (!trigger || !collision) {
    return false;
  }
  if (trigger.requireKinds && !trigger.requireKinds.includes(collision.kind)) {
    return false;
  }
  if (trigger.minSparkIntensity !== undefined && collision.sparkIntensity <= trigger.minSparkIntensity) {
    return false;
  }
  if (trigger.requireHeavy && !collision.heavy) {
    return false;
  }
  return true;
}

function addCollisionBonus(packet: ReturnType<typeof emptyDamagePacket>, attacker: TopRuntimeEntity, collision: CollisionDamageContext): ReturnType<typeof emptyDamagePacket> {
  const drive = getDriveCoreDef(attacker.driveId ?? "drive_shard_barrage");
  const bonus = drive.collisionBonus;
  if (!bonus) {
    return packet;
  }
  const bonusDamage =
    collision.surfaceShear * (bonus.fromSurfaceShear ?? 0) +
    (!collision.heavy ? collision.surfaceShear * (bonus.fromSurfaceShearWhenNotHeavy ?? 0) : 0) +
    Math.abs(collision.tangentImpulse) * (bonus.fromTangentImpulse ?? 0) +
    collision.sparkIntensity * (bonus.fromSparkIntensity ?? 0) +
    collision.normalImpulse * (bonus.fromNormalImpulse ?? 0) +
    (collision.heavy ? collision.normalImpulse * (bonus.fromNormalImpulseOnHeavy ?? 0) : 0) +
    (collision.kind === "grind" ? collision.contactAge * (bonus.fromContactAgeOnGrind ?? 0) : 0) +
    attacker.stats.rpm * (bonus.fromRpm ?? 0);

  return {
    ...packet,
    [bonus.damageType]: packet[bonus.damageType] + bonusDamage,
  };
}

function collisionHazardIntensity(hazard: NonNullable<ReturnType<typeof getDriveCoreDef>["collisionHazard"]>, collision: CollisionDamageContext): number {
  const rawBonus = collision.sparkIntensity * (hazard.fromSparkIntensity ?? 0) + collision.contactAge * (hazard.fromContactAge ?? 0);
  const cappedBonus = hazard.maxIntensityBonus === undefined ? rawBonus : Math.min(hazard.maxIntensityBonus, rawBonus);
  return hazard.baseIntensity + cappedBonus;
}

export function createCollisionDamage(attacker: TopRuntimeEntity, defender: TopRuntimeEntity, collision?: CollisionDamageContext): ReturnType<typeof emptyDamagePacket> {
  const physics = resolveStatsPhysics(attacker.stats);
  const impactSeed = collisionImpactSeedFromMass(physics.designMass);
  const kindFactor = collision?.kind === "smash" ? 1.28 : collision?.kind === "scrape" ? 0.88 : collision?.kind === "grind" ? 0.74 : 1;
  const heavyFactor = collision?.heavy ? 1.16 : 1;
  const playerIncomingScalar = defender.team === "player" ? (attacker.rank === "boss" ? 0.78 : attacker.rank === "elite" ? 0.68 : 0.54) : 1;
  const packet = emptyDamagePacket();
  packet.impact = impactSeed * heavyFactor * kindFactor * playerIncomingScalar;
  return packet;
}

function createSkillDamage(attacker: TopRuntimeEntity, collision?: CollisionDamageContext, behaviors: ActiveRuneBehaviors = {}): ReturnType<typeof emptyDamagePacket> {
  const drive = getDriveCoreDef(attacker.driveId ?? "drive_shard_barrage");
  let packet = { ...(drive.hit?.damage ?? drive.baseDamage) };
  if (collision && (drive.trigger === "onCollision" || drive.trigger === "onHeavyCollision")) {
    const scrapeBonus = collision.kind === "scrape" ? collision.surfaceShear * 0.28 + Math.abs(collision.tangentImpulse) * 0.34 : 0;
    const smashBonus = collision.kind === "smash" ? collision.normalImpulse * 0.42 : 0;
    packet.impact += collision.normalImpulse * 0.2 + Math.abs(collision.tangentImpulse) * (0.22 + attacker.stats.edge) + scrapeBonus + smashBonus;
    packet.impact *= collision.heavy ? 1.14 : 1;
  }
  if (collision) {
    packet = addCollisionBonus(packet, attacker, collision);
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

function ailmentKindForDamageType(type: TopDamageType): AilmentState["kind"] {
  if (type === "heat") {
    return "burn";
  }
  if (type === "static") {
    return "shock";
  }
  if (type === "glass") {
    return "bleed";
  }
  if (type === "void") {
    return "slow";
  }
  return "stagger";
}

function createAilmentState(
  kind: AilmentState["kind"],
  sourceDamageType: TopDamageType,
  sourceId: string,
  magnitude: number,
  duration: number,
): AilmentState | null {
  if (magnitude <= 0 || duration <= 0) {
    return null;
  }
  return {
    id: `${kind}_${sourceId}_${sourceDamageType}`,
    kind,
    sourceDamageType,
    sourceId,
    magnitude,
    duration,
    remainingSeconds: duration,
  };
}

function mergeAilments(entity: TopRuntimeEntity, nextAilments: AilmentState[]): TopRuntimeEntity {
  if (nextAilments.length === 0) {
    return entity;
  }
  const byKind = new Map<AilmentState["kind"], AilmentState>();
  for (const ailment of entity.ailments ?? []) {
    byKind.set(ailment.kind, ailment);
  }
  for (const ailment of nextAilments) {
    const current = byKind.get(ailment.kind);
    byKind.set(
      ailment.kind,
      current
        ? {
            ...ailment,
            magnitude: Math.max(current.magnitude, ailment.magnitude),
            duration: Math.max(current.duration, ailment.duration),
            remainingSeconds: Math.max(current.remainingSeconds, ailment.remainingSeconds),
          }
        : ailment,
    );
  }
  return {
    ...entity,
    ailments: Array.from(byKind.values()).sort((left, right) => left.kind.localeCompare(right.kind)),
  };
}

function ailmentDamageTakenScalar(entity: TopRuntimeEntity): number {
  const shock = (entity.ailments ?? []).filter((ailment) => ailment.kind === "shock").reduce((highest, ailment) => Math.max(highest, ailment.magnitude), 0);
  return 1 + clamp(shock, 0, 0.45);
}

function hasAilment(entity: TopRuntimeEntity, kind: AilmentState["kind"]): boolean {
  return (entity.ailments ?? []).some((ailment) => ailment.kind === kind && ailment.remainingSeconds > 0);
}

function doctrineSkillDamageScalar(
  runtime: TopArenaRuntime,
  attacker: TopRuntimeEntity,
  defender: TopRuntimeEntity,
  hit: ReturnType<typeof resolveTopHit>,
  source: "collision" | "skill",
): number {
  if (source !== "skill" || attacker.team !== "player") {
    return 1;
  }

  let scalar = 1;
  if (hasDoctrineRule(runtime, "overloadSurge")) {
    const omega = createCombatContext(attacker, runtime.combatEvents).omega;
    if (omega >= 11) {
      scalar *= 1.12 + clamp((omega - 11) / 45, 0, 0.08);
    }
  }
  if (hasDoctrineRule(runtime, "stormConduit") && hit.mitigatedDamage.static > 0 && hasAilment(defender, "shock")) {
    scalar *= 1.18;
  }
  return scalar;
}

function buildDoctrineAilments(
  runtime: TopArenaRuntime,
  attacker: TopRuntimeEntity,
  hit: ReturnType<typeof resolveTopHit>,
  source: "collision" | "skill",
  damage: number,
): AilmentState[] {
  if (source !== "skill" || attacker.team !== "player" || !hasDoctrineRule(runtime, "precisionBleed") || hit.critChance <= 0 || hit.expectedCritMultiplier <= 1) {
    return [];
  }

  const duration = 2.8;
  const critPressure = clamp(hit.critChance * (hit.expectedCritMultiplier - 1), 0.04, 0.45);
  const bleed = createAilmentState("bleed", "glass", attacker.id, (damage * critPressure * 0.2) / duration, duration);
  return bleed ? [bleed] : [];
}

function buildAilmentsFromHit(
  attacker: TopRuntimeEntity,
  defender: TopRuntimeEntity,
  drive: ReturnType<typeof getDriveCoreDef>,
  hit: ReturnType<typeof resolveTopHit>,
  source: "collision" | "skill",
  damageScalar: number,
): AilmentState[] {
  const ailments: AilmentState[] = [];
  const maxIntegrity = Math.max(1, defender.stats.maxSpinIntegrity);
  const damageTypes = Object.keys(hit.mitigatedDamage) as TopDamageType[];

  for (const type of damageTypes) {
    const typeDamage = hit.mitigatedDamage[type];
    if (typeDamage <= 0) {
      continue;
    }
    const kind = ailmentKindForDamageType(type);
    const dotProfile = source === "skill" && drive.dot?.damageType === type ? drive.dot : undefined;
    const duration = dotProfile?.duration ?? (kind === "stagger" ? 1.35 : kind === "shock" ? 2.5 : 2.2);
    const baseMagnitude =
      kind === "burn"
        ? (dotProfile ? dotProfile.baseDps * (1 + attacker.stats.resonance * 0.08) : typeDamage * 0.12) * damageScalar
        : kind === "shock"
          ? clamp(typeDamage / maxIntegrity, 0.05, 0.35)
          : kind === "bleed"
            ? (typeDamage * 0.18) / duration
            : kind === "slow"
              ? clamp(typeDamage / maxIntegrity, 0.06, 0.3)
              : clamp(typeDamage / maxIntegrity, 0.05, 0.26);
    const ailment = createAilmentState(kind, type, attacker.id, baseMagnitude, duration);
    if (ailment) {
      ailments.push(ailment);
    }
  }

  return ailments;
}

function tickEntityAilments(entity: TopRuntimeEntity, deltaSeconds: number): TopRuntimeEntity {
  if (!entity.ailments || entity.ailments.length === 0) {
    return entity;
  }

  let nextEntity = entity;
  const nextAilments: AilmentState[] = [];
  for (const ailment of entity.ailments) {
    if (ailment.kind === "burn") {
      nextEntity = {
        ...nextEntity,
        spinIntegrity: Math.max(0, nextEntity.spinIntegrity - ailment.magnitude * deltaSeconds),
      };
    } else if (ailment.kind === "bleed") {
      const speedFactor = 1 + clamp(length(nextEntity.vx, nextEntity.vy) / 220, 0, 1.4);
      nextEntity = {
        ...nextEntity,
        spinIntegrity: Math.max(0, nextEntity.spinIntegrity - ailment.magnitude * speedFactor * deltaSeconds),
      };
    } else if (ailment.kind === "slow") {
      const slowScalar = Math.max(0.65, 1 - ailment.magnitude * deltaSeconds);
      nextEntity = {
        ...nextEntity,
        vx: nextEntity.vx * slowScalar,
        vy: nextEntity.vy * slowScalar,
      };
    } else if (ailment.kind === "stagger") {
      nextEntity = {
        ...nextEntity,
        wobble: clamp(nextEntity.wobble + ailment.magnitude * deltaSeconds, 0, 1),
      };
    }

    const remainingSeconds = ailment.remainingSeconds - deltaSeconds;
    if (remainingSeconds > 0) {
      nextAilments.push({ ...ailment, remainingSeconds });
    }
  }

  return {
    ...nextEntity,
    ailments: nextAilments,
  };
}

function tickAilments(runtime: TopArenaRuntime, deltaSeconds: number): TopArenaRuntime {
  return {
    ...runtime,
    player: tickEntityAilments(runtime.player, deltaSeconds),
    enemies: runtime.enemies.map((enemy) => tickEntityAilments(enemy, deltaSeconds)),
  };
}

function damagePlayer(runtime: TopArenaRuntime, amount: number, impulseX = 0, impulseY = 0): TopArenaRuntime {
  return {
    ...runtime,
    player: {
      ...runtime.player,
      spinIntegrity: Math.max(0, runtime.player.spinIntegrity - amount),
      vx: runtime.player.vx + impulseX,
      vy: runtime.player.vy + impulseY,
    },
  };
}

type RivalMechanicContext = {
  runtime: TopArenaRuntime;
  enemy: TopRuntimeEntity;
  player: TopRuntimeEntity;
  phase: 1 | 2 | 3;
  direction: { x: number; y: number };
  distanceToPlayer: number;
};

type RivalMechanicResult = {
  runtime: TopArenaRuntime;
  enemy: TopRuntimeEntity;
  player: TopRuntimeEntity;
};

const rivalMechanicHandlers: Record<RivalMechanicId, (context: RivalMechanicContext) => RivalMechanicResult> = {
  reflectProjectiles: ({ runtime, enemy, player, phase, direction }) => {
    const playerDrive = getDriveCoreDef(runtime.driveId);
    if (!playerDrive.tags.includes("projectile")) {
      const nextRuntime = addEffect(runtime, {
        kind: "bossSignal",
        x: enemy.x,
        y: enemy.y,
        lifetime: 0.48,
        intensity: 0.95 + phase * 0.12,
      });

      return {
        runtime: nextRuntime,
        player: nextRuntime.player,
        enemy: { ...enemy, bossPhase: phase, cooldownRemaining: phase === 1 ? 2.85 : phase === 2 ? 2.35 : 1.95 },
      };
    }

    const reflectedHit = resolveTopHit({
      baseDamage: createSkillDamage(player, undefined, activeRuneBehaviors(runtime)),
      attacker: player.stats,
      defender: player.stats,
      drive: playerDrive,
      sourceTags: playerDrive.tags,
      context: createCombatContext(player, runtime.combatEvents),
      hitFlags: playerDrive.hit ? { usesTracking: playerDrive.hit.usesTracking, canCrit: playerDrive.hit.canCrit } : undefined,
    });
    const damage = reflectedHit.totalDamage * balanceConfig.rival.reflectRatio;
    let nextRuntime = addEffect(runtime, {
      kind: "stormArc",
      x: enemy.x,
      y: enemy.y,
      x2: player.x,
      y2: player.y,
      lifetime: 0.58,
      intensity: 1.25 + phase * 0.25,
    });
    nextRuntime = emitCombatEvent(nextRuntime, {
      kind: "reflect",
      sourceId: enemy.id,
      targetId: player.id,
      magnitude: damage,
      x: player.x,
      y: player.y,
      driveId: playerDrive.id,
      tags: playerDrive.tags,
    });
    nextRuntime = pushEvent(nextRuntime, "danger", `${enemy.name} reflects projectile pressure`);
    nextRuntime = damagePlayer(nextRuntime, damage, direction.x * 56, direction.y * 56);

    return {
      runtime: nextRuntime,
      player: nextRuntime.player,
      enemy: { ...enemy, bossPhase: phase, cooldownRemaining: phase === 1 ? 2.85 : phase === 2 ? 2.35 : 1.95 },
    };
  },
  gravityWell: ({ runtime, enemy, phase, direction, distanceToPlayer }) => {
    const pull = (115 + enemy.stats.tracking * 0.045) * (1 + (phase - 1) * 0.18);
    let nextRuntime = addEffect(runtime, {
      kind: "bossSignal",
      x: enemy.x,
      y: enemy.y,
      lifetime: 0.78,
      intensity: 1.35 + phase * 0.22,
    });
    nextRuntime = pushEvent(nextRuntime, "danger", `${enemy.name} folds the basin into a gravity well`);
    nextRuntime = {
      ...nextRuntime,
      player: {
        ...nextRuntime.player,
        vx: nextRuntime.player.vx - direction.x * pull,
        vy: nextRuntime.player.vy - direction.y * pull,
      },
    };
    if (distanceToPlayer < 170) {
      nextRuntime = damagePlayer(nextRuntime, 28 + enemy.stats.impact * 0.08, -direction.x * 26, -direction.y * 26);
    }

    return {
      runtime: nextRuntime,
      player: nextRuntime.player,
      enemy: { ...enemy, bossPhase: phase, cooldownRemaining: phase === 1 ? 3.05 : phase === 2 ? 2.55 : 2.1 },
    };
  },
  heavyCrash: ({ runtime, enemy, phase, direction, distanceToPlayer }) => {
    const damage = (62 + enemy.stats.impact * 0.3) * (1 + (phase - 1) * 0.16);
    let nextRuntime = addEffect(pushEvent(runtime, "danger", `${enemy.name} hammers the rim with a heavy crash`), {
      kind: "shockwave",
      x: enemy.x,
      y: enemy.y,
      lifetime: 0.92,
      intensity: 1.9 + phase * 0.28,
    });
    nextRuntime = emitCombatEvent(nextRuntime, {
      kind: "smash",
      sourceId: enemy.id,
      targetId: runtime.player.id,
      magnitude: damage,
      x: enemy.x,
      y: enemy.y,
      driveId: enemy.driveId,
      tags: ["physical", "melee"],
    });
    if (distanceToPlayer < 210) {
      nextRuntime = damagePlayer(nextRuntime, damage, direction.x * 82, direction.y * 82);
    }

    return {
      runtime: nextRuntime,
      player: nextRuntime.player,
      enemy: { ...enemy, bossPhase: phase, cooldownRemaining: phase === 1 ? 3.25 : phase === 2 ? 2.75 : 2.2 },
    };
  },
  phaseShift: ({ runtime, enemy, player, phase }) => {
    const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x) + Math.PI * (0.52 + phase * 0.08);
    const distance = 112 + phase * 18;
    const nextEnemy = {
      ...enemy,
      x: player.x + Math.cos(angle) * distance,
      y: player.y + Math.sin(angle) * distance,
      vx: -Math.sin(angle) * (70 + phase * 16),
      vy: Math.cos(angle) * (70 + phase * 16),
      bossPhase: phase,
      cooldownRemaining: phase === 1 ? 2.55 : phase === 2 ? 2.1 : 1.7,
    };
    let nextRuntime = addEffect(pushEvent(runtime, "danger", `${enemy.name} slips through a phase shift`), {
      kind: "chargeLine",
      x: enemy.x,
      y: enemy.y,
      x2: nextEnemy.x,
      y2: nextEnemy.y,
      lifetime: 0.46,
      intensity: 1.25 + phase * 0.2,
    });
    nextRuntime = emitCombatEvent(nextRuntime, {
      kind: "stance_shift",
      sourceId: enemy.id,
      targetId: player.id,
      magnitude: phase,
      x: nextEnemy.x,
      y: nextEnemy.y,
      driveId: enemy.driveId,
      tags: ["void", "speed"],
    });

    return {
      runtime: nextRuntime,
      player: nextRuntime.player,
      enemy: nextEnemy,
    };
  },
  ringWard: ({ runtime, enemy, phase, direction, distanceToPlayer }) => {
    const ward = enemy.stats.maxFluxGuard * (0.18 + phase * 0.06);
    let nextRuntime = addEffect(pushEvent(runtime, "danger", `${enemy.name} raises a ring ward`), {
      kind: "bossSignal",
      x: enemy.x,
      y: enemy.y,
      lifetime: 0.86,
      intensity: 1.2 + phase * 0.24,
    });
    const nextEnemy = {
      ...enemy,
      fluxGuard: Math.min(enemy.stats.maxFluxGuard, enemy.fluxGuard + ward),
      bossPhase: phase,
      cooldownRemaining: phase === 1 ? 3.05 : phase === 2 ? 2.55 : 2.05,
    };
    if (distanceToPlayer < 150) {
      nextRuntime = damagePlayer(nextRuntime, 34 + enemy.stats.guard * 0.05, direction.x * 38, direction.y * 38);
    }

    return {
      runtime: nextRuntime,
      player: nextRuntime.player,
      enemy: nextEnemy,
    };
  },
};

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

function defenderDamageTakenScalar(runtime: TopArenaRuntime, defender: TopRuntimeEntity): { scalar: number; activated: boolean } {
  const context = createCombatContext(defender, runtime.combatEvents);
  const scalar = defender.stats.modifiers
    .filter((modifier) => modifier.stat === "damage" && modifier.type === "less" && evaluateCombatCondition(modifier.condition, context))
    .reduce((scalar, modifier) => scalar * Math.max(0, 1 - modifier.value), 1);
  return { scalar, activated: scalar < 1 };
}

function emitDefenseStance(runtime: TopArenaRuntime, defender: TopRuntimeEntity, preventedDamage: number): TopArenaRuntime {
  if (runtime.combatEvents.some((event) => event.kind === "stance_shift" && event.sourceId === defender.id)) {
    return runtime;
  }

  return pushEvent(
    emitCombatEvent(
      addEffect(runtime, {
        kind: "bossSignal",
        x: defender.x,
        y: defender.y,
        lifetime: balanceConfig.defeat.defenseStanceTelegraphSeconds,
        intensity: 0.9,
      }),
      {
        kind: "stance_shift",
        sourceId: defender.id,
        magnitude: preventedDamage,
        x: defender.x,
        y: defender.y,
      },
    ),
    "danger",
    `${defender.name} enters defense stance`,
  );
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
    context: createCombatContext(attacker, runtime.combatEvents),
    hitFlags: source === "skill" && drive.hit ? { usesTracking: drive.hit.usesTracking, canCrit: drive.hit.canCrit } : undefined,
  });
  const defenderPhase = defender.rank === "boss" ? bossPhaseFor(defender) : undefined;
  const phaseDamageScalar = defenderPhase === 3 && source === "collision" && !collision?.heavy ? 0.42 : 1;
  const defenseRune = defender.team === "player" ? defenderDamageTakenScalar(runtime, defender) : { scalar: 1, activated: false };
  const ailmentTakenScalar = ailmentDamageTakenScalar(defender);
  const doctrineDamageScalar = doctrineSkillDamageScalar(runtime, attacker, defender, hit, source);
  const rawTotalDamage = hit.totalDamage * damageScalar * phaseDamageScalar * ailmentTakenScalar * doctrineDamageScalar;
  const totalDamage = rawTotalDamage * defenseRune.scalar;
  const energyDamage = source === "collision" ? totalDamage * (collision?.heavy ? balanceConfig.combat.heavyEnergyBleed : 1) : 0;
  const integrityDamage = source === "skill" || collision?.heavy ? totalDamage : 0;
  const bossGate = applyBossPhaseGate(defender, integrityDamage);
  const impulseDirection = normalize(defender.x - attacker.x, defender.y - attacker.y);
  const skillImpulse = source === "skill" ? Math.min(120, bossGate.appliedDamage / defender.stats.mass) * 0.08 : 0;
  const damagedDefender = energyDamage > 0 ? drainSpinEnergy(defender, energyDamage) : defender;
  const hitAilments = [
    ...buildAilmentsFromHit(attacker, defender, drive, hit, source, damageScalar * doctrineDamageScalar),
    ...buildDoctrineAilments(runtime, attacker, hit, source, rawTotalDamage),
  ];
  const defenderNext = mergeAilments(
    {
      ...damagedDefender,
      spinIntegrity: bossGate.nextSpinIntegrity,
      vx: damagedDefender.vx + impulseDirection.x * skillImpulse,
      vy: damagedDefender.vy + impulseDirection.y * skillImpulse,
      wobble: source === "collision" ? clamp(defender.wobble + bossGate.appliedDamage / Math.max(1, defender.stats.maxSpinIntegrity) * 0.3, 0, 1) : defender.wobble,
      bossPhase: defender.rank === "boss" ? bossGate.bossPhase : defender.bossPhase,
      phaseGateCooldown: defender.rank === "boss" ? bossGate.phaseGateCooldown : defender.phaseGateCooldown,
    },
    hitAilments,
  );
  const midpointX = (attacker.x + defender.x) / 2;
  const midpointY = (attacker.y + defender.y) / 2;
  let nextRuntime = addEffect(runtime, {
    kind: source === "skill" ? (drive.visual === "stormArc" ? "stormArc" : drive.visual === "emberTrail" ? "emberTrail" : "spark") : "spark",
    x: midpointX,
    y: midpointY,
    x2: source === "skill" && drive.visual === "stormArc" ? defender.x : undefined,
    y2: source === "skill" && drive.visual === "stormArc" ? defender.y : undefined,
    lifetime: source === "skill" ? 0.55 : 0.24,
    intensity: clamp(Math.max(bossGate.appliedDamage, energyDamage, totalDamage * 0.18) / 180, 0.45, 2.2),
  });
  if (defenseRune.activated && rawTotalDamage > totalDamage) {
    nextRuntime = emitDefenseStance(nextRuntime, defender, rawTotalDamage - totalDamage);
  }
  if (attacker.team === "player" && (bossGate.appliedDamage > 0 || energyDamage > 0)) {
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
      const direction = normalize(player.x - enemy.x, player.y - enemy.y);
      if (enemy.rivalMechanicId) {
        const result = rivalMechanicHandlers[enemy.rivalMechanicId]({
          runtime: { ...nextRuntime, player },
          enemy,
          player,
          phase,
          direction,
          distanceToPlayer,
        });
        nextRuntime = result.runtime;
        nextEnemy = result.enemy;
        player = result.player;
      } else {
        const atlasBonuses = resolveCircuitAtlasBonuses(runtime.loadout.circuitAtlasNodeIds ?? []);
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
    }

    enemies.push(nextEnemy);
  }

  return { ...nextRuntime, player, enemies };
}

function resolveHazards(runtime: TopArenaRuntime, deltaSeconds: number): TopArenaRuntime {
  if (hasDoctrineRule(runtime, "selfHazardSafe")) {
    return runtime;
  }

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
  const keyRisk = runtime.arenaKey ? summarizeArenaKeyRiskReward(runtime.arenaKey) : null;
  const routeRewards = routeRewardBonuses(runtime);
  const anomaly = runtime.loadout.anomalyId ? getArenaAnomalyDef(runtime.loadout.anomalyId) : null;
  const rewardQuantity = (keyRisk?.rewardQuantity ?? 0) + (runtime.activeEvent?.rewardQuantity ?? 0) + (enemy.enemyModifier?.rewardQuantity ?? 0) + routeRewards.rewardQuantity + (anomaly?.rewardQuantity ?? 0);
  const rewardRarity = (keyRisk?.rewardRarity ?? 0) + (runtime.activeEvent?.rewardRarity ?? 0) + (enemy.enemyModifier?.rewardRarity ?? 0) + routeRewards.rewardRarity + (anomaly?.rewardRarity ?? 0);
  const drop = rollDropOutcome({
    arenaId: runtime.arenaId,
    seed: `${runtime.seed}_drop_${runtime.wave}_${runtime.kills}`,
    wave: runtime.wave,
    killCount: runtime.kills,
    playerPartQuantity: runtime.player.stats.partQuantity,
    playerPartRarity: runtime.player.stats.partRarity,
    rewardQuantity,
    rewardRarity,
    rewardBias: [...(keyRisk?.rewardBias ?? []), ...(runtime.activeEvent?.rewardBias ?? [])],
    x: enemy.x,
    y: enemy.y,
  });

  if (!drop) {
    return runtime;
  }

  return addEffect(
    pushEvent({ ...runtime, drops: [drop, ...runtime.drops].slice(0, maxDrops) }, "drop", `${drop.rarity} ${drop.label} dropped`),
    {
      kind: "drop",
      x: enemy.x,
      y: enemy.y,
      lifetime: 0.9,
      intensity: drop.rarity === "relic" ? 2 : drop.rarity === "engraved" ? 1.45 : 1,
    },
  );
}

function handleRivalUniqueDrop(runtime: TopArenaRuntime, enemy: TopRuntimeEntity): TopArenaRuntime {
  if (!runtime.rivalId) {
    return runtime;
  }

  const rival = getNamedRivalDef(runtime.rivalId);
  if (rival.uniqueDropBaseIds.length === 0) {
    return runtime;
  }

  const rng = createRng(`${runtime.seed}_${rival.id}_unique_${runtime.kills}_${runtime.routeClears}`);
  const baseId = rival.uniqueDropBaseIds[rng.int(0, rival.uniqueDropBaseIds.length - 1)];
  const base = getTopPartBaseDef(baseId);
  const drop: ArenaDrop = {
    id: `drop_unique_${rival.id}_${runtime.kills}`,
    label: base.displayName,
    slot: base.slot,
    baseId,
    rarity: "relic",
    x: enemy.x,
    y: enemy.y,
    age: 0,
  };

  return addEffect(
    pushEvent({ ...runtime, drops: [drop, ...runtime.drops].slice(0, maxDrops) }, "drop", `Rival unique ${base.displayName} dropped`),
    {
      kind: "drop",
      x: enemy.x,
      y: enemy.y,
      lifetime: 1,
      intensity: 2.2,
    },
  );
}

function handleKills(runtime: TopArenaRuntime): TopArenaRuntime {
  let nextRuntime = runtime;
  const survivors: TopRuntimeEntity[] = [];

  for (const enemy of runtime.enemies) {
    const energyDepleted = enemy.rank !== "boss" && currentSpinEnergy(enemy) <= 0;
    if (enemy.spinIntegrity > 0 && !energyDepleted) {
      survivors.push(enemy);
      continue;
    }

    const routeCleared = enemy.rank === "boss";
    if (runtime.mode === "duel" && routeCleared) {
      nextRuntime = handleDrops(pushEvent(nextRuntime, "reward", `${enemy.name} duel gate shattered`), enemy);
      nextRuntime = handleRivalUniqueDrop(nextRuntime, enemy);
      nextRuntime = {
        ...nextRuntime,
        outcome: "victory",
        kills: nextRuntime.kills + 1,
        mapKills: 1,
        routeClears: nextRuntime.routeClears + 1,
      };
      continue;
    }

    const nextRouteClears = nextRuntime.routeClears + (routeCleared ? 1 : 0);
    const nextMapKills = routeCleared ? 0 : Math.min(nextRuntime.mapKillTarget, nextRuntime.mapKills + 1);
    const bossNowReady = !routeCleared && nextRuntime.mapKills < nextRuntime.mapKillTarget && nextMapKills >= nextRuntime.mapKillTarget;
    nextRuntime = pushEvent(nextRuntime, "kill", `${enemy.name} shattered`);
    nextRuntime = advanceRouteMechanic(nextRuntime, enemy);
    nextRuntime = handleDrops(nextRuntime, enemy);
    let rewardedPlayer = addSpinEnergy(addFlux(nextRuntime.player, balanceConfig.flux.killRegen), maxSpinEnergy(nextRuntime.player) * 0.14);
    if (hasDoctrineRule(nextRuntime, "fluxRecursion")) {
      rewardedPlayer = addFlux(rewardedPlayer, Math.max(balanceConfig.flux.killRegen, maxFlux(rewardedPlayer) * 0.08));
    }
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
  heavyThresholdScalar = 1,
}: {
  normalImpulse: number;
  surfaceShear: number;
  contactAge: number;
  closingSpeed: number;
  combinedMass: number;
  heavyThresholdScalar?: number;
}): TopCollisionEvent["kind"] {
  if (contactAge >= 0.16 && surfaceShear > 112) {
    return "grind";
  }
  if (normalImpulse > 142 * heavyThresholdScalar || (combinedMass > 2.35 && normalImpulse > 104 * heavyThresholdScalar) || closingSpeed > 132 * heavyThresholdScalar) {
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

export function resolveTopCollisionPhysics(
  player: TopRuntimeEntity,
  enemy: TopRuntimeEntity,
  time: number,
  index: number,
  contactAge: number,
  tuning: ArenaTuningConfig = defaultArenaTuning,
  heavyThresholdScalar = 1,
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
  const playerRingOutPressure = Math.max(0, player.stats.ringOutPressure ?? 0);
  const enemyRingOutPressure = Math.max(0, enemy.stats.ringOutPressure ?? 0);
  const launchPower = clamp(
    recoilEnergy *
      (0.26 + speedRecoilRatio * 0.82 + spinShearRatio * 0.18) *
      centerPocketBoost *
      speedBurst *
      tuning.collisionLaunchMultiplier *
      (1 + clamp(playerRingOutPressure + enemyRingOutPressure, 0, 2.6) * 0.1),
    0,
    launchCap,
  );
  const recoilSeparation = clamp(overlap * 0.58 + launchPower * 0.032, 0, 38);
  const tangentSign = Math.sign(tangentImpulse || relativeTangentialSpeed || 1);
  const playerOutward = outwardFromBasin(playerPositioned, -normal.x, -normal.y);
  const enemyOutward = outwardFromBasin(enemyPositioned, normal.x, normal.y);
  const playerLaunch = normalize(-normal.x * 1.1 + playerOutward.x * 0.7 - tangent.x * tangentSign * 0.22, -normal.y * 1.1 + playerOutward.y * 0.7 - tangent.y * tangentSign * 0.22);
  const enemyLaunch = normalize(normal.x * 1.1 + enemyOutward.x * 0.7 + tangent.x * tangentSign * 0.22, normal.y * 1.1 + enemyOutward.y * 0.7 + tangent.y * tangentSign * 0.22);
  const playerWobbleGain = clamp((normalImpulse * 0.0034 + Math.abs(tangentImpulse) * 0.006 + spinShearRatio * 0.06) / Math.max(0.8, player.stats.mass + player.stats.grip), 0, 0.65);
  const enemyWobbleGain = clamp((normalImpulse * 0.0034 + Math.abs(tangentImpulse) * 0.006 + spinShearRatio * 0.06) / Math.max(0.8, enemy.stats.mass + enemy.stats.grip), 0, 0.65);
  const sparkIntensity = clamp((surfaceShear / 84 + normalImpulse / 104 + (spinRatio(player) + spinRatio(enemy)) * 0.42) * tuning.sparkMultiplier, 0.25, 7.2);
  const kind = classifyCollision({ normalImpulse, surfaceShear, contactAge, closingSpeed, combinedMass: player.stats.mass + enemy.stats.mass, heavyThresholdScalar });
  const heavy =
    kind === "smash" ||
    normalImpulse > 66 * heavyThresholdScalar ||
    closingSpeed > 78 * heavyThresholdScalar ||
    Math.abs(tangentImpulse) > 30 * heavyThresholdScalar ||
    sparkIntensity > 1.8 * heavyThresholdScalar;
  const contactX = playerPositioned.x + normal.x * player.radius;
  const contactY = playerPositioned.y + normal.y * player.radius;

  return {
    player: {
      ...drainCollisionSpinEnergy(playerPositioned, normalImpulse),
      x: playerPositioned.x + playerLaunch.x * recoilSeparation,
      y: playerPositioned.y + playerLaunch.y * recoilSeparation,
      vx: playerPositioned.vx - impulseX * playerInvMass + playerLaunch.x * launchPower * clamp(playerInvMass, 0.52, 1.7) * (1 + clamp(enemyRingOutPressure, 0, 2.6) * 0.22),
      vy: playerPositioned.vy - impulseY * playerInvMass + playerLaunch.y * launchPower * clamp(playerInvMass, 0.52, 1.7) * (1 + clamp(enemyRingOutPressure, 0, 2.6) * 0.22),
      wobble: clamp(playerPositioned.wobble + playerWobbleGain, 0, 1),
    },
    enemy: {
      ...drainCollisionSpinEnergy(enemyPositioned, normalImpulse),
      x: enemyPositioned.x + enemyLaunch.x * recoilSeparation,
      y: enemyPositioned.y + enemyLaunch.y * recoilSeparation,
      vx: enemyPositioned.vx + impulseX * enemyInvMass + enemyLaunch.x * launchPower * clamp(enemyInvMass, 0.52, 1.7) * (1 + clamp(playerRingOutPressure, 0, 2.6) * 0.22),
      vy: enemyPositioned.vy + impulseY * enemyInvMass + enemyLaunch.y * launchPower * clamp(enemyInvMass, 0.52, 1.7) * (1 + clamp(playerRingOutPressure, 0, 2.6) * 0.22),
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
      const heavyThresholdScalar = hasArenaAnomalyRule(runtime.loadout, "heavyResonance") ? balanceConfig.anomaly.heavyResonanceThresholdScalar : 1;
      const resolved = resolveTopCollisionPhysics(player, nextEnemy, runtime.time, index, contactAge, tuning, heavyThresholdScalar);
      player = hasDoctrineRule(nextRuntime, "anchorMass")
        ? {
            ...resolved.player,
            vx: resolved.player.vx * 0.84,
            vy: resolved.player.vy * 0.84,
            wobble: resolved.player.wobble * 0.85,
          }
        : resolved.player;
      nextEnemy = resolved.enemy;
      nextRuntime = { ...nextRuntime, lastCollision: resolved.collision };
      nextRuntime = emitCombatEvent(nextRuntime, {
        kind: resolved.collision.kind,
        sourceId: player.id,
        targetId: nextEnemy.id,
        magnitude: resolved.collision.normalImpulse,
        x: resolved.collision.x,
        y: resolved.collision.y,
      });

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
      const leftWobbleGain = clamp((normalImpulse * 0.0018 + Math.abs(tangentImpulse) * 0.0034 + overlap * 0.004) / Math.max(0.8, left.stats.mass + left.stats.grip), 0, 0.34);
      const rightWobbleGain = clamp((normalImpulse * 0.0018 + Math.abs(tangentImpulse) * 0.0034 + overlap * 0.004) / Math.max(0.8, right.stats.mass + right.stats.grip), 0, 0.34);

      enemies[leftIndex] = {
        ...drainCollisionSpinEnergy(left, normalImpulse),
        x: left.x - normal.x * leftCorrection + leftLaunch.x * recoilSeparation,
        y: left.y - normal.y * leftCorrection + leftLaunch.y * recoilSeparation,
        vx: left.vx - impulseX * leftInvMass + leftLaunch.x * launchPower * clamp(leftInvMass, 0.42, 1.55),
        vy: left.vy - impulseY * leftInvMass + leftLaunch.y * launchPower * clamp(leftInvMass, 0.42, 1.55),
        wobble: clamp(left.wobble + leftWobbleGain, 0, 1),
      };
      enemies[rightIndex] = {
        ...drainCollisionSpinEnergy(right, normalImpulse),
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
  const collisionDriven = collisionReady && collisionMatchesTrigger(drive.collisionTrigger, runtime.lastCollision);
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
  const gateStatus = evaluateDriveGate(drive, createCombatContext(runtime.player, runtime.combatEvents));
  if (!gateStatus.unlocked) {
    return runtime;
  }
  if (currentFlux(runtime.player) < driveFluxCost) {
    if (currentFlux(runtime.player) <= 0.001) {
      return emitCombatEvent(runtime, {
        kind: "overheat",
        sourceId: runtime.player.id,
        targetId: target.id,
        magnitude: driveFluxCost,
        x: runtime.player.x,
        y: runtime.player.y,
        driveId: drive.id,
        tags: drive.tags,
      });
    }
    return runtime;
  }
  let enemies = runtime.enemies;
  let nextRuntime = emitCombatEvent({ ...runtime, player: spendFlux(runtime.player, driveFluxCost) }, {
    kind: "discharge",
    sourceId: runtime.player.id,
    targetId: target.id,
    magnitude: driveFluxCost,
    x: target.x,
    y: target.y,
    driveId: drive.id,
    tags: drive.tags,
  });
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

  if (runtime.lastCollision && drive.collisionHazard && collisionMatchesTrigger({ requireKinds: drive.collisionHazard.requireKinds }, runtime.lastCollision)) {
    nextRuntime = addEffect(nextRuntime, {
      kind: "hazard",
      x: runtime.lastCollision.x,
      y: runtime.lastCollision.y,
      lifetime: drive.collisionHazard.lifetime,
      intensity: collisionHazardIntensity(drive.collisionHazard, runtime.lastCollision),
    });
  }

  const cooldownPressure =
    runeValidation.costMultiplier +
    behaviorCount(runeBehaviors, "repeat") * 0.08 +
    behaviorCount(runeBehaviors, "projectileCount") * 0.06 +
    behaviorCount(runeBehaviors, "chain") * 0.05 -
    behaviorCount(runeBehaviors, "trigger") * 0.08;
  const cooldownPhysics = resolveStatsPhysics(nextRuntime.player.stats, { spinEnergy: currentSpinEnergy(nextRuntime.player) });
  const cooldownRemaining = effectiveCooldownFromOmega(
    drive.baseCooldown * Math.max(0.65, cooldownPressure),
    cooldownPhysics.omega,
    nextRuntime.player.stats.resonance,
    nextRuntime.player.stats.cooldownRecovery ?? 0,
  );

  return {
    ...nextRuntime,
    player: { ...nextRuntime.player, cooldownRemaining },
    enemies,
  };
}

function recoverPlayer(player: TopRuntimeEntity, deltaSeconds: number): TopRuntimeEntity {
  const guardRecovery = player.stats.maxFluxGuard * 0.04 * deltaSeconds * player.stats.resonance;
  const fluxRecovery = balanceConfig.flux.naturalRegenPerSecond * deltaSeconds * Math.max(0.35, player.stats.resonance + (player.stats.reservationEfficiency ?? 0));
  const recoveredFlux = addFlux(player, fluxRecovery);

  return {
    ...recoveredFlux,
    fluxGuard: Math.min(recoveredFlux.stats.maxFluxGuard, recoveredFlux.fluxGuard + guardRecovery),
  };
}

function sustainPlayerEnergy(runtime: TopArenaRuntime, deltaSeconds: number): TopArenaRuntime {
  if (hasArenaAnomalyRule(runtime.loadout, "noFluxSustain")) {
    return runtime;
  }

  return {
    ...runtime,
    player: sustainSpinEnergyFromFlux(runtime.player, deltaSeconds),
  };
}

function emitStabilizeEventIfNeeded(runtime: TopArenaRuntime, previousPlayer: TopRuntimeEntity): TopArenaRuntime {
  const previousEnergyRatio = spinEnergyRatio(previousPlayer);
  const nextEnergyRatio = spinEnergyRatio(runtime.player);
  const energyStabilized = previousEnergyRatio < 0.3 && nextEnergyRatio >= 0.3;
  const wobbleStabilized = previousPlayer.wobble > 0.001 && runtime.player.wobble <= 0.001;

  if (!energyStabilized && !wobbleStabilized) {
    return runtime;
  }

  return emitCombatEvent(runtime, {
    kind: "stabilize",
    sourceId: runtime.player.id,
    magnitude: energyStabilized ? nextEnergyRatio : previousPlayer.wobble,
    x: runtime.player.x,
    y: runtime.player.y,
  });
}

export function stepTopArenaRuntime(runtime: TopArenaRuntime, deltaSeconds: number, tuningOverrides?: Partial<ArenaTuningConfig>): TopArenaRuntime {
  if (runtime.outcome !== "ongoing") {
    return runtime;
  }

  const immediateOutcome = resolvePlayerDefeat(runtime);
  if (immediateOutcome.outcome !== "ongoing") {
    return immediateOutcome;
  }

  const arenaRadius = arenaRadiusForRuntime(runtime);
  const tuning = normalizeArenaTuning(tuningOverrides);
  const previousPlayer = runtime.player;
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
    combatEvents: [],
  };
  nextRuntime = tickAilments(nextRuntime, deltaSeconds);
  nextRuntime = tickRouteMechanic(nextRuntime, deltaSeconds);

  if (nextRuntime.nextEnemyIn <= 0 && nextRuntime.routeTransitionCooldown <= 0) {
    const bossReady = nextRuntime.mode === "duel" || nextRuntime.mapKills >= nextRuntime.mapKillTarget;
    const smallEnemies = activeSmallEnemyCount(nextRuntime);
    const bossEnemy = nextRuntime.enemies.find((enemy) => enemy.rank === "boss");
    if (bossReady && !nextRuntime.bossSpawned && nextRuntime.enemies.length === 0) {
      nextRuntime = spawnEnemy(nextRuntime, "boss", tuning);
    } else if (!bossReady && !bossEnemy && smallEnemies < desiredSmallEnemyCount(nextRuntime, tuning)) {
      nextRuntime = spawnEnemy(nextRuntime, undefined, tuning);
    }
  }

  const firstEnemy = nextRuntime.enemies[0] ?? null;
  const ringoutGateScalar = nextRuntime.mode === "duel" ? 0.68 : 1;
  const playerRingoutGateScalar = ringoutGateScalar * (hasDoctrineRule(nextRuntime, "anchorMass") ? 1.35 : 1);
  const playerSteer = steerEntity(nextRuntime.player, firstEnemy, arenaRadius, deltaSeconds, tuning, playerRingoutGateScalar);
  let player = playerSteer.entity;
  if (playerSteer.combatEvent) {
    nextRuntime = emitCombatEvent(nextRuntime, playerSteer.combatEvent);
  }
  const enemies = nextRuntime.enemies.map((enemy) => {
    const result = steerEntity(enemy, player, arenaRadius, deltaSeconds, tuning, ringoutGateScalar);
    if (result.combatEvent) {
      nextRuntime = emitCombatEvent(nextRuntime, result.combatEvent);
    }
    return result.entity;
  });
  nextRuntime = { ...nextRuntime, player, enemies };
  nextRuntime = resolveEnemyCrowdPhysics(nextRuntime, tuning);
  nextRuntime = resolveEnemySkills(nextRuntime);
  nextRuntime = resolveHazards(nextRuntime, deltaSeconds);
  nextRuntime = resolveCollisions(nextRuntime, deltaSeconds, tuning);
  nextRuntime = resolvePlayerSkill(nextRuntime);
  nextRuntime = sustainPlayerEnergy(nextRuntime, deltaSeconds);
  nextRuntime = emitStabilizeEventIfNeeded(nextRuntime, previousPlayer);
  nextRuntime = handleKills(nextRuntime);
  nextRuntime = resolvePlayerDefeat(nextRuntime);

  return nextRuntime;
}
