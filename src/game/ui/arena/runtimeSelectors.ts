import { balanceConfig } from "../../data/balanceConfig";
import { getDriveCoreDef } from "../../data/driveCores";
import { evaluateDriveGate, type DriveGateStatus } from "../../engine/driveGate";
import { clamp } from "../../engine/math";
import { collisionImpactSeedFromMass, resolveStatsPhysics } from "../../engine/topPhysics";
import type { CombatEvent, TopRuntimeEntity } from "../../engine/topTypes";

function maxSpinEnergy(entity: TopRuntimeEntity): number {
  return Math.max(1, entity.maxSpinEnergy ?? entity.stats.maxSpinIntegrity);
}

function currentSpinEnergy(entity: TopRuntimeEntity): number {
  return entity.spinEnergy ?? clamp(entity.spinPower / 100, 0, 1.2) * maxSpinEnergy(entity);
}

function maxFlux(entity: TopRuntimeEntity): number {
  return Math.max(1, entity.maxFlux ?? resolveStatsPhysics(entity.stats).maxFlux);
}

function currentFlux(entity: TopRuntimeEntity): number {
  return entity.flux ?? maxFlux(entity);
}

function combatContextForSelector(entity: TopRuntimeEntity, events: CombatEvent[] = []) {
  const physics = resolveStatsPhysics(entity.stats, { spinEnergy: currentSpinEnergy(entity) });
  return {
    physics,
    spinEnergyRatio: clamp(currentSpinEnergy(entity) / maxSpinEnergy(entity), 0, 1.2),
    fluxRatio: clamp(currentFlux(entity) / maxFlux(entity), 0, 1.2),
    omega: physics.omega,
    events,
  };
}

export function selectLifeRatio(entity: TopRuntimeEntity): number {
  if (entity.spinEnergy !== undefined || entity.maxSpinEnergy !== undefined) {
    return clamp((entity.spinEnergy ?? 0) / Math.max(1, entity.maxSpinEnergy ?? entity.stats.maxSpinIntegrity), 0, 1);
  }
  return clamp(entity.spinIntegrity / Math.max(1, entity.stats.maxSpinIntegrity), 0, 1);
}

export function selectFluxRatio(entity: TopRuntimeEntity): number {
  if (entity.flux !== undefined || entity.maxFlux !== undefined) {
    return clamp((entity.flux ?? 0) / Math.max(1, entity.maxFlux ?? entity.stats.maxFluxGuard), 0, 1);
  }
  return clamp(entity.fluxGuard / Math.max(1, entity.stats.maxFluxGuard), 0, 1);
}

export function selectFluxLow(entity: TopRuntimeEntity): boolean {
  if (entity.flux !== undefined || entity.maxFlux !== undefined) {
    return (entity.flux ?? 0) <= Math.max(1, entity.maxFlux ?? entity.stats.maxFluxGuard) * balanceConfig.flux.lowThresholdRatio;
  }
  return selectFluxRatio(entity) <= balanceConfig.flux.lowThresholdRatio;
}

export function selectOmega(entity: TopRuntimeEntity): number {
  return combatContextForSelector(entity).omega;
}

export function selectAttackFrequency(entity: TopRuntimeEntity): number {
  return combatContextForSelector(entity).physics.attackFrequency;
}

export function selectDpsBreakdown(entity: TopRuntimeEntity): { collisionSeed: number; attackFrequency: number; collisionDps: number } {
  const physics = combatContextForSelector(entity).physics;
  const collisionSeed = collisionImpactSeedFromMass(physics.designMass);
  const attackFrequency = physics.attackFrequency;
  return {
    collisionSeed,
    attackFrequency,
    collisionDps: collisionSeed * attackFrequency,
  };
}

export function selectESustain(entity: TopRuntimeEntity): { fluxPerSecond: number; energyPerSecond: number; secondsRemaining: number } {
  const physics = combatContextForSelector(entity).physics;
  const canSustain = currentFlux(entity) > physics.fluxLowThreshold;
  const fluxPerSecond = canSustain ? Math.min(balanceConfig.flux.energySustainConversionPerSecond, currentFlux(entity)) : 0;
  return {
    fluxPerSecond,
    energyPerSecond: fluxPerSecond * balanceConfig.flux.fluxToEnergyRate,
    secondsRemaining: currentFlux(entity) / Math.max(0.001, balanceConfig.flux.energySustainConversionPerSecond),
  };
}

export function selectDriveGateStatus(entity: TopRuntimeEntity, driveId: string, events: CombatEvent[] = []): DriveGateStatus {
  return evaluateDriveGate(getDriveCoreDef(driveId), combatContextForSelector(entity, events));
}
