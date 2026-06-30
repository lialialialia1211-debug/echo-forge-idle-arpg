import { getBossGateDef } from "../data/bossGates";
import { summarizeArenaKeyRiskReward } from "./arenaKeys";
import { projectTopCombat } from "./topCombat";
import { resolveTopRuntimeStats } from "./topAssembly";
import { clamp } from "./math";
import type { ArenaKey, BossGateAttemptProjection, BossGateFailureReason, TopDamageType, TopLoadoutConfig } from "./topTypes";

function pushIfBelow(
  failureReasons: BossGateFailureReason[],
  recommendedStats: BossGateAttemptProjection["recommendedStats"],
  reason: BossGateFailureReason,
  current: number,
  required: number,
) {
  if (current >= required) {
    return;
  }
  failureReasons.push(reason);
  recommendedStats[reason] = Math.round(required * 1000) / 1000;
}

export function projectBossGateAttempt({
  gateId,
  frameId,
  driveId,
  loadout = {},
  arenaKey,
}: {
  gateId: string;
  frameId: string;
  driveId: string;
  loadout?: TopLoadoutConfig;
  arenaKey?: ArenaKey;
}): BossGateAttemptProjection {
  const gate = getBossGateDef(gateId);
  const keyRisk = arenaKey ? summarizeArenaKeyRiskReward(arenaKey) : null;
  const projection = projectTopCombat({
    arenaId: gate.arenaId,
    frameId,
    driveId,
    loadout,
  });
  const stats = resolveTopRuntimeStats(frameId, driveId, loadout);
  const bossPressure = 1 + (keyRisk?.bossPressure ?? 0);
  const requiredDps = gate.requiredDps * (keyRisk?.enemyIntegrityMultiplier ?? 1) * bossPressure;
  const requiredGuard = gate.requiredGuard * (keyRisk?.enemyImpactMultiplier ?? 1) * bossPressure;
  const failureReasons: BossGateFailureReason[] = [];
  const recommendedStats: BossGateAttemptProjection["recommendedStats"] = {};

  pushIfBelow(failureReasons, recommendedStats, "dps", projection.totalDps, requiredDps);
  pushIfBelow(failureReasons, recommendedStats, "tracking", stats.tracking, gate.requiredTracking);
  pushIfBelow(failureReasons, recommendedStats, "guard", stats.guard, requiredGuard);
  pushIfBelow(failureReasons, recommendedStats, "drift", stats.drift, gate.requiredDrift);
  pushIfBelow(failureReasons, recommendedStats, "grip", stats.grip, gate.requiredGrip);

  for (const [type, required] of Object.entries(gate.requiredResistance) as Array<[TopDamageType, number]>) {
    if ((stats.resistances[type] ?? 0) < required) {
      failureReasons.push("resistance");
      recommendedStats.resistance = Math.max(recommendedStats.resistance ?? 0, required);
      break;
    }
  }

  if (projection.sustainScore < 1.25) {
    failureReasons.push("sustain");
    recommendedStats.sustain = 1.25;
  }

  const dpsRatio = projection.totalDps / Math.max(1, requiredDps);
  const defenseRatio = projection.effectiveHp / Math.max(1, gate.bossIntegrity * 0.42 * bossPressure);
  const controlRatio = (stats.grip / gate.requiredGrip + stats.tracking / gate.requiredTracking) / 2;
  const successChance = clamp((dpsRatio * 0.45 + defenseRatio * 0.35 + controlRatio * 0.2) / 1.15, 0.02, 0.98);
  const estimatedTtk = gate.bossIntegrity * bossPressure / Math.max(1, projection.totalDps);

  return {
    gateId,
    successChance: Math.round(successChance * 1000) / 1000,
    estimatedTtk: Math.round(estimatedTtk * 100) / 100,
    failureReasons: Array.from(new Set(failureReasons)),
    recommendedStats,
    rewardUnlocks: gate.rewardUnlocks,
  };
}
