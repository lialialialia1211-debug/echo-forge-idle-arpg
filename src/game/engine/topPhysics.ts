import { balanceConfig } from "../data/balanceConfig";
import type { TopRuntimeStats } from "./topTypes";

export type TopPhysicsInput = {
  mass: number;
  maxSpinIntegrity?: number;
  resonance?: number;
  volume?: number;
  inertiaBias?: number;
  force?: number;
  spinEnergy?: number;
};

export type TopDerivedPhysics = {
  designMass: number;
  volume: number;
  force: number;
  spinEnergy: number;
  momentOfInertia: number;
  omega: number;
  attackFrequency: number;
  maxFlux: number;
  fluxLowThreshold: number;
};

export function toDesignMass(legacyMass: number): number {
  return Math.max(0.1, legacyMass * balanceConfig.topPhysics.legacyMassToDesignMass);
}

export function levelPower(level: number): number {
  const safeLevel = Math.max(1, level);
  return balanceConfig.progression.levelPowerBase * safeLevel ** balanceConfig.progression.levelPowerExponent;
}

export function initialSpinEnergy(force: number): number {
  return Math.max(0, force * balanceConfig.topPhysics.energyPerForce);
}

export function momentOfInertia(mass: number, volume: number): number {
  return Math.max(0.001, mass * Math.pow(Math.max(0.001, volume), 2 / 3));
}

export function omegaFromEnergy(spinEnergy: number, inertia: number): number {
  if (spinEnergy <= 0) {
    return 0;
  }
  return Math.sqrt((2 * spinEnergy) / Math.max(0.001, inertia));
}

export function attackFrequencyFromOmega(omega: number): number {
  return Math.max(0, omega * balanceConfig.topPhysics.frequencyLambda);
}

export function collisionImpactSeedFromMass(mass: number): number {
  return Math.max(0, mass * balanceConfig.topPhysics.massDamageKappa);
}

export function effectiveCooldownFromOmega(baseSeconds: number, omega: number, resonance = 1, cooldownRecovery = 0): number {
  const speedScalar = balanceConfig.topPhysics.omegaReference / Math.max(balanceConfig.topPhysics.minOmega, omega);
  const recoveryScalar = Math.max(0.35, resonance + cooldownRecovery);
  return (baseSeconds * speedScalar) / recoveryScalar;
}

export function maxFluxFromResonance(resonance = 1): number {
  return balanceConfig.flux.baseMax + Math.max(0, resonance) * balanceConfig.flux.maxPerResonance;
}

export function resolveDerivedTopPhysics(input: TopPhysicsInput): TopDerivedPhysics {
  const designMass = toDesignMass(input.mass);
  const baseVolume = input.volume ?? balanceConfig.topPhysics.defaultVolume;
  const volume = baseVolume * Math.max(0.55, 1 + (input.inertiaBias ?? 0));
  const force = input.force ?? balanceConfig.topPhysics.fallbackForce;
  const spinEnergy = input.spinEnergy ?? input.maxSpinIntegrity ?? initialSpinEnergy(force);
  const moment = momentOfInertia(designMass, volume);
  const omega = omegaFromEnergy(spinEnergy, moment);
  const maxFlux = maxFluxFromResonance(input.resonance);

  return {
    designMass,
    volume,
    force,
    spinEnergy,
    momentOfInertia: moment,
    omega,
    attackFrequency: attackFrequencyFromOmega(omega),
    maxFlux,
    fluxLowThreshold: maxFlux * balanceConfig.flux.lowThresholdRatio,
  };
}

export function resolveStatsPhysics(stats: TopRuntimeStats, options: Pick<TopPhysicsInput, "volume" | "force" | "spinEnergy"> = {}): TopDerivedPhysics {
  return resolveDerivedTopPhysics({
    mass: stats.mass,
    maxSpinIntegrity: stats.maxSpinIntegrity,
    resonance: stats.resonance,
    inertiaBias: stats.inertiaBias,
    ...options,
  });
}

export function towerRequirement(floor: number): number {
  const safeFloor = Math.max(0, floor);
  return balanceConfig.progression.towerRequirementBase * balanceConfig.progression.towerRequirementGrowth ** safeFloor;
}

export function enemyArmorForFloor(floor: number): number {
  if (floor < balanceConfig.progression.armorStartFloor) {
    return 0;
  }
  return balanceConfig.progression.armorBase * balanceConfig.progression.armorGrowth ** (floor - balanceConfig.progression.armorStartFloor);
}
