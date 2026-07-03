import { getDriveCoreDef } from "../data/driveCores";
import { getArenaCircuitDef } from "../data/arenaCircuits";
import { emptyDamagePacket, zeroResistances, type DamagePacket, type TopLoadoutConfig, type TopRuntimeStats } from "./topTypes";
import { resolveTopRuntimeStats } from "./topAssembly";
import { resolveTopHit } from "./topDamage";
import { clamp } from "./math";
import { collisionImpactSeedFromMass, effectiveCooldownFromOmega, resolveStatsPhysics } from "./topPhysics";

export type TopCombatProjection = {
  collisionDps: number;
  driveDps: number;
  dotDps: number;
  totalDps: number;
  effectiveHp: number;
  sustainScore: number;
  ringOutRisk: number;
  missingLayers: Array<"dps" | "tracking" | "guard" | "drift" | "grip" | "resistance" | "sustain">;
};

export function createProjectionEnemyStats(arenaId: string): TopRuntimeStats {
  const arena = getArenaCircuitDef(arenaId);
  return {
    maxSpinIntegrity: arena.enemyIntegrity,
    maxFluxGuard: arena.enemyIntegrity * 0.12,
    guard: arena.enemyGuard,
    drift: 260 + arena.tier * 60,
    tracking: 500 + arena.tier * 72,
    impact: arena.enemyImpact,
    rpm: 5.2,
    mass: 1 + arena.tier * 0.08,
    grip: 0.36 + arena.tier * 0.06,
    edge: 0.04,
    fracture: 1.35,
    resonance: 0.8,
    partQuantity: 0,
    partRarity: 0,
    resistances: {
      ...zeroResistances(),
      heat: arena.tier * 0.04,
      glass: arena.tier * 0.03,
      static: arena.tier * 0.035,
      void: arena.tier * 0.025,
    },
    modifiers: [],
  };
}

export function createCollisionPacket(stats: TopRuntimeStats): DamagePacket {
  const physics = resolveStatsPhysics(stats);
  const packet = emptyDamagePacket();
  packet.impact = collisionImpactSeedFromMass(physics.designMass);
  return packet;
}

function scaleDotDps(baseDps: number, damageType: keyof DamagePacket, attacker: TopRuntimeStats, defender: TopRuntimeStats): number {
  const increased = attacker.modifiers
    .filter((modifier) => (modifier.stat === damageType || modifier.stat === "damage") && modifier.type === "increased")
    .reduce((sum, modifier) => sum + modifier.value, 0);
  const more = attacker.modifiers
    .filter((modifier) => (modifier.stat === damageType || modifier.stat === "damage") && modifier.type === "more")
    .reduce((product, modifier) => product * (1 + modifier.value), 1);
  const resistance = clamp(defender.resistances[damageType] ?? 0, -0.75, 0.9);
  return baseDps * (1 + increased) * more * (1 - resistance);
}

export function projectTopCombat({
  arenaId,
  frameId,
  driveId,
  loadout = {},
}: {
  arenaId: string;
  frameId: string;
  driveId: string;
  loadout?: TopLoadoutConfig;
}): TopCombatProjection {
  const drive = getDriveCoreDef(driveId);
  const player = resolveTopRuntimeStats(frameId, driveId, loadout);
  const playerPhysics = resolveStatsPhysics(player);
  const defaultContext = {
    physics: playerPhysics,
    spinEnergyRatio: 1,
    fluxRatio: 1,
    omega: playerPhysics.omega,
    events: [],
  };
  const enemy = createProjectionEnemyStats(arenaId);
  const collisionHit = resolveTopHit({
    baseDamage: createCollisionPacket(player),
    attacker: player,
    defender: enemy,
    drive,
    sourceTags: ["attack", "melee"],
    context: defaultContext,
  });
  const driveHit = resolveTopHit({
    baseDamage: drive.hit?.damage ?? drive.baseDamage,
    attacker: player,
    defender: enemy,
    drive,
    sourceTags: drive.tags,
    context: defaultContext,
  });
  const collisionDps = collisionHit.totalDamage * Math.max(0.25, playerPhysics.attackFrequency);
  const cooldown = drive.cooldown?.baseSeconds ?? drive.baseCooldown;
  const effectiveCooldown = effectiveCooldownFromOmega(cooldown, playerPhysics.omega, player.resonance, player.cooldownRecovery ?? 0);
  const driveDps = driveHit.totalDamage / Math.max(0.25, effectiveCooldown);
  const dotDps = drive.dot ? scaleDotDps(drive.dot.baseDps, drive.dot.damageType, player, enemy) : 0;
  const totalDps = collisionDps + driveDps + dotDps;
  const averageResistance = Object.values(player.resistances).reduce((sum, value) => sum + value, 0) / 5;
  const effectiveHp = (player.maxSpinIntegrity + player.maxFluxGuard) * (1 + player.guard / 1000) * (1 + averageResistance);
  const sustainScore = player.resonance + player.guard / 900 + player.grip;
  const ringOutRisk = clamp(1 - (player.grip + player.mass * 0.18 + player.drift / 2200), 0, 1);
  const missingLayers: TopCombatProjection["missingLayers"] = [];

  const targetDps = arenaId.includes("red_chancel") ? 420 : 260;
  if (totalDps < targetDps) {
    missingLayers.push("dps");
  }
  if (player.tracking < enemy.drift * 1.4) {
    missingLayers.push("tracking");
  }
  if (player.guard < enemy.impact * 2) {
    missingLayers.push("guard");
  }
  if (ringOutRisk > 0.48) {
    missingLayers.push("grip");
  }
  if (sustainScore < 1.25) {
    missingLayers.push("sustain");
  }

  return {
    collisionDps: Math.round(collisionDps),
    driveDps: Math.round(driveDps),
    dotDps: Math.round(dotDps),
    totalDps: Math.round(totalDps),
    effectiveHp: Math.round(effectiveHp),
    sustainScore: Math.round(sustainScore * 1000) / 1000,
    ringOutRisk: Math.round(ringOutRisk * 1000) / 1000,
    missingLayers,
  };
}
