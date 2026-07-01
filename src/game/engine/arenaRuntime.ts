import { getArenaCircuitDef } from "../data/arenaCircuits";
import { arenaEvents } from "../data/arenaEvents";
import { getDriveCoreDef } from "../data/driveCores";
import { enemyModifiers } from "../data/enemyModifiers";
import { getTopFrameDef } from "../data/topFrames";
import { summarizeArenaKeyRiskReward } from "./arenaKeys";
import { clamp } from "./math";
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
} from "./topTypes";
import { emptyDamagePacket, zeroResistances } from "./topTypes";

const maxEvents = 8;
const maxEffects = 80;
const maxDrops = 12;
const minMapKillTarget = 150;
const maxMapKillTarget = 200;
const maxActiveSmallEnemies = 20;

export const defaultArenaTuning: ArenaTuningConfig = {
  basinPullMultiplier: 1.38,
  collisionLaunchMultiplier: 1.35,
  sparkMultiplier: 1.16,
  activeEnemyPressure: 1,
  bossWeightMultiplier: 1,
  hitStopMultiplier: 1,
};

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

function spinRatio(entity: TopRuntimeEntity): number {
  return clamp(entity.spinPower / 100, 0.08, 1.2);
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

function createEnemyStats(arenaId: string, rank: TopRuntimeEntity["rank"], wave: number, arenaKey?: ArenaKey, activeEvent?: ArenaEventState, modifier?: EnemyModifierDef): TopRuntimeStats {
  const arena = getArenaCircuitDef(arenaId);
  const keyRisk = arenaKey ? summarizeArenaKeyRiskReward(arenaKey) : null;
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
      (modifier?.integrityMultiplier ?? 1),
    maxFluxGuard: arena.enemyIntegrity * 0.12 * rankScalar,
    guard: arena.enemyGuard * rankScalar * (keyRisk?.enemyGuardMultiplier ?? 1) * (activeEvent?.enemyGuardMultiplier ?? 1) * (modifier?.guardMultiplier ?? 1),
    drift: 260 + arena.tier * 60,
    tracking: 500 + arena.tier * 72,
    impact: arena.enemyImpact * rankScalar * (1 + wave * 0.025) * (keyRisk?.enemyImpactMultiplier ?? 1) * (activeEvent?.enemyImpactMultiplier ?? 1) * (modifier?.impactMultiplier ?? 1),
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
  const density = 9 + arena.tier * 2 + Math.floor(mapProgressRatio(runtime) * 6);
  return Math.min(maxActiveSmallEnemies, Math.max(4, Math.round(density * tuning.activeEnemyPressure)));
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
  const baseStats = createEnemyStats(runtime.arenaId, rank, difficultyWave, runtime.arenaKey, runtime.activeEvent, modifier);
  const stats =
    rank === "boss"
      ? {
          ...baseStats,
          mass: baseStats.mass * tuning.bossWeightMultiplier,
          guard: baseStats.guard * (1 + (tuning.bossWeightMultiplier - 1) * 0.12),
          grip: clamp(baseStats.grip + (tuning.bossWeightMultiplier - 1) * 0.08, 0.45, 0.94),
        }
      : baseStats;
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
    wobble: 0,
    cooldownRemaining: initialCooldownForBehavior(behaviorId, rank),
    stats,
    behaviorId,
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
    wobble: 0,
    cooldownRemaining: 0,
    stats,
    driveId,
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
  const initialEvents: ArenaLogEvent[] = [
    ...(activeEvent ? [{ id: "top_event_event", tone: "danger" as const, text: `${activeEvent.displayName}: ${activeEvent.logText}` }] : []),
    { id: "top_event_0", tone: "reward" as const, text: "Arena coil is armed" },
  ].slice(0, maxEvents);
  const mapKillTarget = createMapKillTarget(arenaId, seed, 0, arenaKey);

  return {
    seed,
    arenaId,
    arenaKey,
    activeEvent,
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

  const frictionDrain = (0.18 + entity.stats.grip * 0.22 + speed * 0.0012) * deltaSeconds;
  const wobbleRecovery = Math.max(0, entity.wobble - (0.28 + entity.stats.grip * 0.18) * deltaSeconds);

  return {
    ...entity,
    x,
    y,
    vx,
    vy,
    angle: entity.angle + entity.stats.rpm * spinRatio(entity) * deltaSeconds * 4.5,
    spinPower: Math.max(4, entity.spinPower - frictionDrain),
    wobble: wobbleRecovery,
    cooldownRemaining: Math.max(0, entity.cooldownRemaining - deltaSeconds),
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

function createSkillDamage(attacker: TopRuntimeEntity, collision?: CollisionDamageContext): ReturnType<typeof emptyDamagePacket> {
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

  return packet;
}

function damagePlayer(runtime: TopArenaRuntime, amount: number, impulseX = 0, impulseY = 0): TopArenaRuntime {
  return {
    ...runtime,
    player: {
      ...runtime.player,
      spinIntegrity: Math.max(1, runtime.player.spinIntegrity - amount),
      vx: runtime.player.vx + impulseX,
      vy: runtime.player.vy + impulseY,
    },
  };
}

function dealDamage(
  runtime: TopArenaRuntime,
  attacker: TopRuntimeEntity,
  defender: TopRuntimeEntity,
  source: "collision" | "skill",
  collision?: CollisionDamageContext,
): { runtime: TopArenaRuntime; defender: TopRuntimeEntity } {
  const drive = getDriveCoreDef(attacker.team === "player" ? attacker.driveId ?? runtime.driveId : "drive_shard_barrage");
  const baseDamage = source === "collision" ? createCollisionDamage(attacker, defender, collision) : createSkillDamage(attacker, collision);
  const hit = resolveTopHit({
    baseDamage,
    attacker: attacker.stats,
    defender: defender.stats,
    drive,
    sourceTags: source === "collision" ? ["attack", "melee"] : drive.tags,
  });
  const impulseDirection = normalize(defender.x - attacker.x, defender.y - attacker.y);
  const skillImpulse = source === "skill" ? Math.min(120, hit.totalDamage / defender.stats.mass) * 0.08 : 0;
  const defenderNext = {
    ...defender,
    spinIntegrity: Math.max(0, defender.spinIntegrity - hit.totalDamage),
    vx: defender.vx + impulseDirection.x * skillImpulse,
    vy: defender.vy + impulseDirection.y * skillImpulse,
    wobble: source === "collision" ? clamp(defender.wobble + hit.totalDamage / Math.max(1, defender.stats.maxSpinIntegrity) * 0.3, 0, 1) : defender.wobble,
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
    intensity: clamp(hit.totalDamage / 180, 0.45, 2.2),
  });

  if (source === "skill") {
    nextRuntime = pushEvent(nextRuntime, "skill", `${drive.displayName} hits for ${Math.round(hit.totalDamage).toLocaleString()}`);
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
      const direction = normalize(player.x - enemy.x, player.y - enemy.y);
      const shockDamage = 72 + enemy.stats.impact * 0.24;
      nextEnemy = { ...nextEnemy, cooldownRemaining: 3.4 };
      nextRuntime = pushEvent(nextRuntime, "danger", `${enemy.name} releases Judicator shockwave`);
      nextRuntime = addEffect(nextRuntime, {
        kind: "shockwave",
        x: enemy.x,
        y: enemy.y,
        lifetime: 0.9,
        intensity: 2.1,
      });
      if (distanceToPlayer < 190) {
        nextRuntime = damagePlayer(nextRuntime, shockDamage, direction.x * 48, direction.y * 48);
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

function handleDrops(runtime: TopArenaRuntime, enemy: TopRuntimeEntity): TopArenaRuntime {
  const arena = getArenaCircuitDef(runtime.arenaId);
  const keyRisk = runtime.arenaKey ? summarizeArenaKeyRiskReward(runtime.arenaKey) : null;
  const rng = createRng(`${runtime.seed}_drop_${runtime.wave}_${runtime.kills}`);
  const rewardQuantity = (keyRisk?.rewardQuantity ?? 0) + (runtime.activeEvent?.rewardQuantity ?? 0) + (enemy.enemyModifier?.rewardQuantity ?? 0);
  const rewardRarity = (keyRisk?.rewardRarity ?? 0) + (runtime.activeEvent?.rewardRarity ?? 0) + (enemy.enemyModifier?.rewardRarity ?? 0);
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
    nextRuntime = handleDrops(nextRuntime, enemy);
    nextRuntime = {
      ...nextRuntime,
      player: {
        ...nextRuntime.player,
        spinIntegrity: Math.min(nextRuntime.player.stats.maxSpinIntegrity, nextRuntime.player.spinIntegrity + nextRuntime.player.stats.maxSpinIntegrity * 0.14),
        fluxGuard: Math.min(nextRuntime.player.stats.maxFluxGuard, nextRuntime.player.fluxGuard + nextRuntime.player.stats.maxFluxGuard * 0.2),
      },
      kills: nextRuntime.kills + 1,
      wave: nextRuntime.wave + 1,
      mapKills: nextMapKills,
      mapKillTarget: routeCleared ? createMapKillTarget(nextRuntime.arenaId, nextRuntime.seed, nextRouteClears, nextRuntime.arenaKey) : nextRuntime.mapKillTarget,
      bossSpawned: routeCleared ? false : nextRuntime.bossSpawned,
      routeClears: nextRouteClears,
      nextEnemyIn: routeCleared ? 1.8 : nextMapKills >= nextRuntime.mapKillTarget ? 0.65 : 0.16,
    };
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
      ...playerPositioned,
      x: playerPositioned.x + playerLaunch.x * recoilSeparation,
      y: playerPositioned.y + playerLaunch.y * recoilSeparation,
      vx: playerPositioned.vx - impulseX * playerInvMass + playerLaunch.x * launchPower * clamp(playerInvMass, 0.52, 1.7),
      vy: playerPositioned.vy - impulseY * playerInvMass + playerLaunch.y * launchPower * clamp(playerInvMass, 0.52, 1.7),
      spinPower: Math.max(4, playerPositioned.spinPower - playerSpinLoss),
      wobble: clamp(playerPositioned.wobble + playerWobbleGain, 0, 1),
    },
    enemy: {
      ...enemyPositioned,
      x: enemyPositioned.x + enemyLaunch.x * recoilSeparation,
      y: enemyPositioned.y + enemyLaunch.y * recoilSeparation,
      vx: enemyPositioned.vx + impulseX * enemyInvMass + enemyLaunch.x * launchPower * clamp(enemyInvMass, 0.52, 1.7),
      vy: enemyPositioned.vy + impulseY * enemyInvMass + enemyLaunch.y * launchPower * clamp(enemyInvMass, 0.52, 1.7),
      spinPower: Math.max(4, enemyPositioned.spinPower - enemySpinLoss),
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
      player = { ...enemyHit.defender, spinIntegrity: Math.max(1, enemyHit.defender.spinIntegrity) };

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

  const enemies = runtime.enemies.map((enemy) => ({ ...enemy }));

  for (let leftIndex = 0; leftIndex < enemies.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < enemies.length; rightIndex += 1) {
      const left = enemies[leftIndex];
      const right = enemies[rightIndex];
      const dx = right.x - left.x;
      const dy = right.y - left.y;
      const distance = length(dx, dy);
      const fallbackAngle = (leftIndex * 1.9 + rightIndex * 2.7 + runtime.time) % (Math.PI * 2);
      const normal = distance > 0.001 ? { x: dx / distance, y: dy / distance } : { x: Math.cos(fallbackAngle), y: Math.sin(fallbackAngle) };
      const crowdDistance = (left.radius + right.radius) * 0.86;
      const overlap = crowdDistance - distance;

      if (overlap <= 0) {
        continue;
      }

      const leftInvMass = 1 / Math.max(0.45, left.stats.mass);
      const rightInvMass = 1 / Math.max(0.45, right.stats.mass);
      const invMassSum = leftInvMass + rightInvMass;
      const pressure = clamp(0.45 + tuning.activeEnemyPressure * 0.22, 0.5, 0.9);
      const leftCorrection = overlap * pressure * (leftInvMass / invMassSum);
      const rightCorrection = overlap * pressure * (rightInvMass / invMassSum);
      const relativeVx = right.vx - left.vx;
      const relativeVy = right.vy - left.vy;
      const relativeNormalSpeed = relativeVx * normal.x + relativeVy * normal.y;
      const closingSpeed = Math.max(0, -relativeNormalSpeed);
      const bounce = (closingSpeed * 0.32 + overlap * 5.2) / invMassSum;
      const impulseX = normal.x * bounce;
      const impulseY = normal.y * bounce;

      enemies[leftIndex] = {
        ...left,
        x: left.x - normal.x * leftCorrection,
        y: left.y - normal.y * leftCorrection,
        vx: left.vx - impulseX * leftInvMass,
        vy: left.vy - impulseY * leftInvMass,
        wobble: clamp(left.wobble + overlap * 0.004, 0, 1),
      };
      enemies[rightIndex] = {
        ...right,
        x: right.x + normal.x * rightCorrection,
        y: right.y + normal.y * rightCorrection,
        vx: right.vx + impulseX * rightInvMass,
        vy: right.vy + impulseY * rightInvMass,
        wobble: clamp(right.wobble + overlap * 0.004, 0, 1),
      };
    }
  }

  return { ...runtime, enemies };
}

function resolvePlayerSkill(runtime: TopArenaRuntime): TopArenaRuntime {
  const drive = getDriveCoreDef(runtime.driveId);
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
  const skillHit = dealDamage(runtime, runtime.player, target, "skill", collisionDamageContext);
  let nextRuntime = skillHit.runtime;
  if (runtime.lastCollision && (drive.id === "drive_molten_groove" || (drive.id === "drive_ember_scour" && runtime.lastCollision.kind === "grind"))) {
    nextRuntime = addEffect(nextRuntime, {
      kind: "hazard",
      x: runtime.lastCollision.x,
      y: runtime.lastCollision.y,
      lifetime: drive.id === "drive_molten_groove" ? 2.6 : 1.8,
      intensity: drive.id === "drive_molten_groove" ? 1.25 + Math.min(1.4, runtime.lastCollision.contactAge * 2.2) : 0.85 + Math.min(1, runtime.lastCollision.sparkIntensity * 0.2),
    });
  }

  return {
    ...nextRuntime,
    player: { ...nextRuntime.player, cooldownRemaining: drive.baseCooldown / Math.max(0.35, runtime.player.stats.resonance) },
    enemies: runtime.enemies.map((enemy) => (enemy.id === target.id ? skillHit.defender : enemy)),
  };
}

function recoverPlayer(player: TopRuntimeEntity, deltaSeconds: number): TopRuntimeEntity {
  const integrityRecovery = player.stats.maxSpinIntegrity * 0.025 * deltaSeconds * player.stats.resonance;
  const guardRecovery = player.stats.maxFluxGuard * 0.04 * deltaSeconds * player.stats.resonance;

  return {
    ...player,
    spinIntegrity: Math.min(player.stats.maxSpinIntegrity, Math.max(player.spinIntegrity, player.stats.maxSpinIntegrity * 0.04) + integrityRecovery),
    fluxGuard: Math.min(player.stats.maxFluxGuard, player.fluxGuard + guardRecovery),
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
    effects: runtime.effects
      .map((effect) => ({ ...effect, age: effect.age + deltaSeconds }))
      .filter((effect) => effect.age < effect.lifetime),
    drops: runtime.drops.map((drop) => ({ ...drop, age: drop.age + deltaSeconds })).slice(0, maxDrops),
    lastCollision: undefined,
  };

  if (nextRuntime.nextEnemyIn <= 0) {
    const bossReady = nextRuntime.mapKills >= nextRuntime.mapKillTarget;
    const smallEnemies = activeSmallEnemyCount(nextRuntime);
    if (bossReady && !nextRuntime.bossSpawned && nextRuntime.enemies.length === 0) {
      nextRuntime = spawnEnemy(nextRuntime, "boss", tuning);
    } else if (!bossReady && smallEnemies < desiredSmallEnemyCount(nextRuntime, tuning)) {
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
