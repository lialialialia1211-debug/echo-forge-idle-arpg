import { getArenaCircuitDef } from "../data/arenaCircuits";
import { getDriveCoreDef } from "../data/driveCores";
import { getTopFrameDef } from "../data/topFrames";
import { clamp } from "./math";
import { createRng } from "./rng";
import { resolveTopRuntimeStats } from "./topAssembly";
import { resolveTopHit } from "./topDamage";
import type { ArenaDrop, ArenaEffect, ArenaLogEvent, TopArenaRuntime, TopLoadoutConfig, TopRuntimeEntity, TopRuntimeStats } from "./topTypes";
import { emptyDamagePacket, zeroResistances } from "./topTypes";

const maxEvents = 8;
const maxEffects = 80;
const maxDrops = 12;

function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

function normalize(x: number, y: number): { x: number; y: number } {
  const magnitude = length(x, y) || 1;
  return { x: x / magnitude, y: y / magnitude };
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

function createEnemyStats(arenaId: string, rank: TopRuntimeEntity["rank"], wave: number): TopRuntimeStats {
  const arena = getArenaCircuitDef(arenaId);
  const earlyWaveEase = wave <= 8 ? 0.86 : 1;
  const rankScalar = rank === "boss" ? 3.2 * earlyWaveEase : rank === "elite" ? 1.45 * earlyWaveEase : 1;
  const waveScalar = 1 + Math.max(0, wave - 1) * 0.045;

  return {
    maxSpinIntegrity: arena.enemyIntegrity * rankScalar * waveScalar,
    maxFluxGuard: arena.enemyIntegrity * 0.12 * rankScalar,
    guard: arena.enemyGuard * rankScalar,
    drift: 260 + arena.tier * 60,
    tracking: 500 + arena.tier * 72,
    impact: arena.enemyImpact * rankScalar * (1 + wave * 0.025),
    rpm: rank === "boss" ? 4.2 : rank === "elite" ? 5.2 : 5.8,
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
      heat: arena.tier * 0.04,
      glass: arena.tier * 0.03,
      static: arena.tier * 0.035,
      void: arena.tier * 0.025,
    },
    modifiers: [],
  };
}

function enemyRankForWave(wave: number): TopRuntimeEntity["rank"] {
  if (wave % 8 === 0) {
    return "boss";
  }
  if (wave % 4 === 0) {
    return "elite";
  }
  return "pack";
}

function spawnEnemy(runtime: TopArenaRuntime): TopArenaRuntime {
  const arena = getArenaCircuitDef(runtime.arenaId);
  const rng = createRng(`${runtime.seed}_${runtime.wave}_${runtime.kills}`);
  const angle = rng.next() * Math.PI * 2;
  const rank = enemyRankForWave(runtime.wave);
  const radius = rank === "boss" ? 34 : rank === "elite" ? 28 : 22;
  const stats = createEnemyStats(runtime.arenaId, rank, runtime.wave);
  const distance = arena.radius * (0.74 + rng.next() * 0.12);
  const enemy: TopRuntimeEntity = {
    id: `enemy_${runtime.wave}_${runtime.kills}`,
    team: "enemy",
    name: rank === "boss" ? "Brass Judicator" : rank === "elite" ? "Scored Iron Rival" : "Cinder Runner",
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
    cooldownRemaining: 0,
    stats,
  };

  return addEffect(
    pushEvent({ ...runtime, enemies: [...runtime.enemies, enemy], nextEnemyIn: rank === "boss" ? 1.4 : 0.45 }, "danger", `${enemy.name} enters wave ${runtime.wave}`),
    {
      kind: "spawn",
      x: enemy.x,
      y: enemy.y,
      lifetime: 0.75,
      intensity: rank === "boss" ? 1.8 : 1,
    },
  );
}

function createPlayer(frameId: string, driveId: string, loadout: TopLoadoutConfig = {}): TopRuntimeEntity {
  const frame = getTopFrameDef(frameId);
  const stats = resolveTopRuntimeStats(frameId, driveId, loadout);

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
}: {
  arenaId: string;
  frameId: string;
  driveId: string;
  loadout?: TopLoadoutConfig;
  seed?: string;
}): TopArenaRuntime {
  return {
    seed,
    arenaId,
    frameId,
    driveId,
    loadout,
    time: 0,
    wave: 1,
    kills: 0,
    routeClears: 0,
    nextEnemyIn: 0.2,
    eventIndex: 0,
    player: createPlayer(frameId, driveId, loadout),
    enemies: [],
    effects: [],
    drops: [],
    events: [{ id: "top_event_0", tone: "reward", text: "Arena coil is armed" }],
  };
}

function steerEntity(entity: TopRuntimeEntity, target: TopRuntimeEntity | null, arenaRadius: number, deltaSeconds: number): TopRuntimeEntity {
  let desiredX = -entity.x * 0.25;
  let desiredY = -entity.y * 0.25;

  if (target) {
    desiredX = target.x - entity.x;
    desiredY = target.y - entity.y;
  }

  const direction = normalize(desiredX, desiredY);
  const acceleration = entity.stats.rpm * (entity.team === "player" ? 34 : 26);
  const maxSpeed = 88 + entity.stats.rpm * 14;
  let vx = entity.vx + direction.x * acceleration * deltaSeconds;
  let vy = entity.vy + direction.y * acceleration * deltaSeconds;
  const speed = length(vx, vy);

  if (speed > maxSpeed) {
    vx = (vx / speed) * maxSpeed;
    vy = (vy / speed) * maxSpeed;
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
  }

  return {
    ...entity,
    x,
    y,
    vx,
    vy,
    angle: entity.angle + entity.stats.rpm * deltaSeconds * 4.5,
    cooldownRemaining: Math.max(0, entity.cooldownRemaining - deltaSeconds),
  };
}

function createCollisionDamage(attacker: TopRuntimeEntity, defender: TopRuntimeEntity): ReturnType<typeof emptyDamagePacket> {
  const relativeSpeed = length(attacker.vx - defender.vx, attacker.vy - defender.vy);
  const packet = emptyDamagePacket();
  packet.impact = attacker.stats.impact + relativeSpeed * attacker.stats.mass * 0.38;
  return packet;
}

function createSkillDamage(attacker: TopRuntimeEntity): ReturnType<typeof emptyDamagePacket> {
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

  return packet;
}

function dealDamage(runtime: TopArenaRuntime, attacker: TopRuntimeEntity, defender: TopRuntimeEntity, source: "collision" | "skill"): { runtime: TopArenaRuntime; defender: TopRuntimeEntity } {
  const drive = getDriveCoreDef(attacker.team === "player" ? attacker.driveId ?? runtime.driveId : "drive_shard_barrage");
  const baseDamage = source === "collision" ? createCollisionDamage(attacker, defender) : createSkillDamage(attacker);
  const hit = resolveTopHit({
    baseDamage,
    attacker: attacker.stats,
    defender: defender.stats,
    drive,
    sourceTags: source === "collision" ? ["attack", "melee"] : drive.tags,
  });
  const defenderNext = {
    ...defender,
    spinIntegrity: Math.max(0, defender.spinIntegrity - hit.totalDamage),
    vx: defender.vx + normalize(defender.x - attacker.x, defender.y - attacker.y).x * Math.min(120, hit.totalDamage / defender.stats.mass) * 0.08,
    vy: defender.vy + normalize(defender.x - attacker.x, defender.y - attacker.y).y * Math.min(120, hit.totalDamage / defender.stats.mass) * 0.08,
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

function handleDrops(runtime: TopArenaRuntime, enemy: TopRuntimeEntity): TopArenaRuntime {
  const arena = getArenaCircuitDef(runtime.arenaId);
  const rng = createRng(`${runtime.seed}_drop_${runtime.wave}_${runtime.kills}`);
  const dropChance = clamp(0.26 * arena.rewardMultiplier * (1 + runtime.player.stats.partQuantity), 0.08, 0.95);

  if (rng.next() > dropChance) {
    return runtime;
  }

  const rarityRoll = rng.next() * (1 + runtime.player.stats.partRarity + arena.tier * 0.05);
  const rarity: ArenaDrop["rarity"] = rarityRoll > 0.98 ? "relic" : rarityRoll > 0.62 ? "engraved" : rarityRoll > 0.28 ? "tuned" : "common";
  const labels = ["Attack Ring", "Weight Disk", "Needle Tip", "Ash Core", "Storm Seal", "Launcher", "Circuit Chip"];
  const drop: ArenaDrop = {
    id: `drop_${runtime.wave}_${runtime.kills}`,
    label: labels[rng.int(0, labels.length - 1)],
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
      routeClears: nextRuntime.routeClears + (routeCleared ? 1 : 0),
      nextEnemyIn: routeCleared ? 1.8 : 0.45,
    };
  }

  return { ...nextRuntime, enemies: survivors };
}

function resolveCollisions(runtime: TopArenaRuntime): TopArenaRuntime {
  let nextRuntime = runtime;
  let player = runtime.player;
  const enemies: TopRuntimeEntity[] = [];

  for (const enemy of runtime.enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = length(dx, dy);
    const collisionDistance = enemy.radius + player.radius;
    let nextEnemy = enemy;

    if (distance < collisionDistance) {
      const normal = normalize(dx, dy);
      const overlap = collisionDistance - distance;
      player = { ...player, x: player.x - normal.x * overlap * 0.45, y: player.y - normal.y * overlap * 0.45 };
      nextEnemy = { ...nextEnemy, x: nextEnemy.x + normal.x * overlap * 0.55, y: nextEnemy.y + normal.y * overlap * 0.55 };

      const playerHit = dealDamage(nextRuntime, player, nextEnemy, "collision");
      nextRuntime = playerHit.runtime;
      nextEnemy = playerHit.defender;

      const enemyHit = dealDamage(nextRuntime, nextEnemy, player, "collision");
      nextRuntime = enemyHit.runtime;
      player = { ...enemyHit.defender, spinIntegrity: Math.max(1, enemyHit.defender.spinIntegrity) };
    }

    enemies.push(nextEnemy);
  }

  return { ...nextRuntime, player, enemies };
}

function resolvePlayerSkill(runtime: TopArenaRuntime): TopArenaRuntime {
  const drive = getDriveCoreDef(runtime.driveId);
  const target = runtime.enemies[0];
  if (!target || runtime.player.cooldownRemaining > 0) {
    return runtime;
  }

  const distanceToTarget = length(target.x - runtime.player.x, target.y - runtime.player.y);
  const projectileAssist = drive.tags.includes("projectile") && distanceToTarget < runtime.player.radius + target.radius + 170;
  const triggerReady =
    drive.trigger === "onCooldown" ||
    projectileAssist ||
    (drive.trigger === "onCollision" && distanceToTarget < runtime.player.radius + target.radius + 18) ||
    (drive.trigger === "onHeavyCollision" && distanceToTarget < runtime.player.radius + target.radius + 10);

  if (!triggerReady) {
    return runtime;
  }

  const skillHit = dealDamage(runtime, runtime.player, target, "skill");
  return {
    ...skillHit.runtime,
    player: { ...skillHit.runtime.player, cooldownRemaining: drive.baseCooldown / Math.max(0.35, runtime.player.stats.resonance) },
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

export function stepTopArenaRuntime(runtime: TopArenaRuntime, deltaSeconds: number): TopArenaRuntime {
  const arena = getArenaCircuitDef(runtime.arenaId);
  let nextRuntime = {
    ...runtime,
    time: runtime.time + deltaSeconds,
    player: recoverPlayer(runtime.player, deltaSeconds),
    nextEnemyIn: Math.max(0, runtime.nextEnemyIn - deltaSeconds),
    effects: runtime.effects
      .map((effect) => ({ ...effect, age: effect.age + deltaSeconds }))
      .filter((effect) => effect.age < effect.lifetime),
    drops: runtime.drops.map((drop) => ({ ...drop, age: drop.age + deltaSeconds })).slice(0, maxDrops),
  };

  if (nextRuntime.enemies.length === 0 && nextRuntime.nextEnemyIn <= 0) {
    nextRuntime = spawnEnemy(nextRuntime);
  }

  const firstEnemy = nextRuntime.enemies[0] ?? null;
  const player = steerEntity(nextRuntime.player, firstEnemy, arena.radius, deltaSeconds);
  const enemies = nextRuntime.enemies.map((enemy) => steerEntity(enemy, player, arena.radius, deltaSeconds));
  nextRuntime = { ...nextRuntime, player, enemies };
  nextRuntime = resolvePlayerSkill(nextRuntime);
  nextRuntime = resolveCollisions(nextRuntime);
  nextRuntime = handleKills(nextRuntime);

  return nextRuntime;
}
