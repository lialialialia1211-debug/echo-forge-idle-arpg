import { balanceConfig } from "../../data/balanceConfig";
import { clamp } from "../../engine/math";
import type { TopRuntimeEntity } from "../../engine/topTypes";

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
