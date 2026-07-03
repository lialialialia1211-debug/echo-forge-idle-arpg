import { getArenaAnomalyDef } from "../../data/arenaAnomalies";
import { getArenaCircuitDef } from "../../data/arenaCircuits";
import { balanceConfig } from "../../data/balanceConfig";
import { getDriveCoreDef } from "../../data/driveCores";
import { tutorialSteps, type TutorialTrigger } from "../../data/tutorialSteps";
import { attrValueForCondition, evaluateCombatCondition, type CombatContext } from "../../engine/conditionEval";
import { evaluateDriveGate, type DriveGateStatus } from "../../engine/driveGate";
import { clamp } from "../../engine/math";
import { createCollisionPacket, createProjectionEnemyStats, projectTopCombat } from "../../engine/topCombat";
import { resolveTopHit } from "../../engine/topDamage";
import { dropChanceForArena } from "../../engine/topDropRolls";
import { effectiveCooldownFromOmega, resolveStatsPhysics } from "../../engine/topPhysics";
import type { CircuitNetworkNodeDef, CombatCondition, CombatEvent, DamagePacket, DriveCoreDef, TopLoadoutConfig, TopModifierDef, TopRuntimeEntity, TopRuntimeStats, TuningRuneDef } from "../../engine/topTypes";

export type FeatureUnlockId = "skills" | "forge" | "talents" | "doctrine" | "arenaKeys" | "bossGate" | "wallet" | "anomaly";

export type FeatureUnlockContext = {
  seenTutorialIds: readonly string[];
  activeTutorialTriggers: Partial<Record<TutorialTrigger, boolean>>;
};

export const featureUnlockTutorialIds: Record<FeatureUnlockId, string> = {
  skills: "tut_first_rune",
  forge: "tut_first_forge",
  talents: "tut_first_talent",
  doctrine: "tut_doctrine",
  arenaKeys: "tut_first_key",
  bossGate: "tut_boss_gate",
  wallet: "tut_first_forge",
  anomaly: "tut_first_anomaly",
};

const tutorialStepById = new Map(tutorialSteps.map((step) => [step.id, step]));

export function isFeatureUnlocked(featureId: FeatureUnlockId, context: FeatureUnlockContext): boolean {
  const tutorialId = featureUnlockTutorialIds[featureId];
  const step = tutorialStepById.get(tutorialId);
  if (!step) {
    return false;
  }
  return context.seenTutorialIds.includes(tutorialId) || Boolean(context.activeTutorialTriggers[step.trigger]);
}

export function selectVisibleNetworkNodeIds(nodes: readonly CircuitNetworkNodeDef[], unlockedNodeIds: ReadonlySet<string>): Set<string> {
  return new Set(
    nodes
      .filter((node) => {
        if (unlockedNodeIds.has(node.id)) {
          return true;
        }
        const requiredNodeIds = node.requiredNodeIds ?? [];
        return requiredNodeIds.length === 0 || requiredNodeIds.every((nodeId) => unlockedNodeIds.has(nodeId));
      })
      .map((node) => node.id),
  );
}

export function shouldCollapseCircuitAtlas(availableAtlasPoints: number, allocatedAtlasNodeIds: readonly string[]): boolean {
  return availableAtlasPoints <= 0 && allocatedAtlasNodeIds.length === 0;
}

export function selectVisibleRunes(runes: readonly TuningRuneDef[], ownedRuneIds: ReadonlySet<string>, catalogExpanded: boolean): TuningRuneDef[] {
  return catalogExpanded ? [...runes] : runes.filter((rune) => ownedRuneIds.has(rune.id));
}

export type BuildArchetypeId = "projectileClear" | "fireTrail" | "chainTrigger" | "heavyDuel" | "bossing" | "idleSafety";

export type BuildArchetypeGap = "lowClear" | "lowBossing" | "lowSafety" | "lowSynergy" | "highRisk";

export type BuildArchetypeScore = {
  id: BuildArchetypeId;
  score: number;
};

export type BuildArchetypeProjection = {
  primary: BuildArchetypeId;
  scores: BuildArchetypeScore[];
  gaps: BuildArchetypeGap[];
};

export type BuildArchetypeProjectionInput = {
  drive: DriveCoreDef;
  runes: readonly TuningRuneDef[];
  stats: TopRuntimeStats;
  dps: {
    collisionDps: number;
    driveDps: number;
    dotDps: number;
    totalDps: number;
  };
  routeStrategy?: RouteStrategyProjection;
};

export type RuneRecommendationContext = {
  driveTags: readonly string[];
  buildArchetype: BuildArchetypeProjection;
};

function hasTag(tags: readonly string[], tag: string): number {
  return tags.includes(tag) ? 1 : 0;
}

function behaviorCount(runes: readonly TuningRuneDef[], behavior: NonNullable<TuningRuneDef["behavior"]>): number {
  return runes.filter((rune) => rune.behavior === behavior).length;
}

function runeBuildScore(rune: TuningRuneDef, { driveTags, buildArchetype }: RuneRecommendationContext): number {
  const requiredTagScore = rune.requiredTags.reduce((score, tag) => score + (driveTags.includes(tag) ? 1 : 0), 0) / Math.max(1, rune.requiredTags.length);
  const behavior = rune.behavior;
  const primary = buildArchetype.primary;
  const tagTargets: Record<BuildArchetypeId, string[]> = {
    projectileClear: ["projectile", "critical", "attack", "speed"],
    fireTrail: ["fire", "duration", "area", "control"],
    chainTrigger: ["lightning", "chain", "spell"],
    heavyDuel: ["melee", "physical", "speed"],
    bossing: ["critical", "spell", "attack", "physical", "lightning", "fire"],
    idleSafety: ["spell", "fire", "physical", "control"],
  };
  const behaviorTargets: Record<BuildArchetypeId, Array<NonNullable<TuningRuneDef["behavior"]>>> = {
    projectileClear: ["projectileCount", "trigger"],
    fireTrail: ["duration", "area", "defense"],
    chainTrigger: ["chain", "trigger", "repeat"],
    heavyDuel: ["repeat", "defense", "risk"],
    bossing: ["repeat", "trigger", "projectileCount", "chain"],
    idleSafety: ["defense", "duration"],
  };
  const tagScore = rune.requiredTags.some((tag) => tagTargets[primary].includes(tag)) ? 0.26 : 0;
  const behaviorScore = behavior && behaviorTargets[primary].includes(behavior) ? 0.3 : 0;
  const gapScore =
    buildArchetype.gaps.includes("lowSafety") && behavior === "defense"
      ? 0.16
      : buildArchetype.gaps.includes("lowClear") && (behavior === "area" || behavior === "chain" || behavior === "projectileCount")
        ? 0.12
        : buildArchetype.gaps.includes("lowBossing") && (behavior === "repeat" || behavior === "trigger")
          ? 0.12
          : 0;
  const riskPenalty = buildArchetype.gaps.includes("highRisk") && behavior === "risk" ? 0.22 : 0;
  return roundedScore(requiredTagScore * 0.36 + tagScore + behaviorScore + gapScore - riskPenalty);
}

export function selectRecommendedRunes(
  runes: readonly TuningRuneDef[],
  ownedRuneIds: ReadonlySet<string>,
  catalogExpanded: boolean,
  context: RuneRecommendationContext,
): TuningRuneDef[] {
  return selectVisibleRunes(runes, ownedRuneIds, catalogExpanded).sort((left, right) => {
    const leftActive = ownedRuneIds.has(left.id) ? 1 : 0;
    const rightActive = ownedRuneIds.has(right.id) ? 1 : 0;
    const leftScore = runeBuildScore(left, context) + leftActive * 0.18;
    const rightScore = runeBuildScore(right, context) + rightActive * 0.18;
    return rightScore - leftScore || left.id.localeCompare(right.id);
  });
}

export function selectBuildArchetypeProjection({ drive, runes, stats, dps, routeStrategy }: BuildArchetypeProjectionInput): BuildArchetypeProjection {
  const driveTags = drive.tags;
  const totalDps = Math.max(1, dps.totalDps);
  const runeSynergy = runes.length > 0 ? runes.filter((rune) => rune.requiredTags.some((tag) => driveTags.includes(tag))).length / runes.length : 0;
  const clearStat = clamp(stats.tracking / 900 + stats.rpm / 28, 0, 1);
  const safetyStat = clamp(stats.guard / 720 + stats.grip * 2.8 + (stats.resistances.heat + stats.resistances.static + stats.resistances.void) / 2.4, 0, 1);
  const bossStat = clamp(totalDps / 360 + stats.edge * 1.6, 0, 1);
  const riskPressure = Math.max(0, routeStrategy?.riskScore ?? 0.25);
  const idleSignal = routeStrategy?.idleScore ?? clamp((1 - riskPressure) * 0.6 + safetyStat * 0.4, 0, 1);
  const scores: BuildArchetypeScore[] = [
    {
      id: "projectileClear",
      score: roundedScore(
        hasTag(driveTags, "projectile") * 0.36 +
          hasTag(driveTags, "critical") * 0.12 +
          clamp(dps.driveDps / totalDps, 0, 1) * 0.18 +
          clearStat * 0.2 +
          Math.min(2, behaviorCount(runes, "projectileCount") + behaviorCount(runes, "trigger")) * 0.07,
      ),
    },
    {
      id: "fireTrail",
      score: roundedScore(
        hasTag(driveTags, "fire") * 0.28 +
          hasTag(driveTags, "duration") * 0.2 +
          hasTag(driveTags, "area") * 0.14 +
          clamp(dps.dotDps / totalDps, 0, 1) * 0.22 +
          Math.min(2, behaviorCount(runes, "duration") + behaviorCount(runes, "area")) * 0.08,
      ),
    },
    {
      id: "chainTrigger",
      score: roundedScore(
        hasTag(driveTags, "chain") * 0.3 +
          hasTag(driveTags, "lightning") * 0.22 +
          Math.min(2, behaviorCount(runes, "chain") + behaviorCount(runes, "trigger")) * 0.1 +
          clamp(stats.tracking / 1100 + stats.resonance / 1.6, 0, 1) * 0.18 +
          clamp(dps.driveDps / totalDps, 0, 1) * 0.1,
      ),
    },
    {
      id: "heavyDuel",
      score: roundedScore(
        hasTag(driveTags, "melee") * 0.24 +
          hasTag(driveTags, "physical") * 0.16 +
          clamp(dps.collisionDps / totalDps, 0, 1) * 0.18 +
          clamp(stats.mass / 9 + stats.impact / 650 + stats.guard / 1000, 0, 1) * 0.26 +
          Math.min(2, behaviorCount(runes, "repeat") + behaviorCount(runes, "defense")) * 0.08,
      ),
    },
    {
      id: "bossing",
      score: roundedScore(bossStat * 0.42 + clamp(dps.driveDps / totalDps, 0, 1) * 0.18 + (1 - riskPressure) * 0.2 + runeSynergy * 0.2),
    },
    {
      id: "idleSafety",
      score: roundedScore(idleSignal * 0.36 + safetyStat * 0.28 + runeSynergy * 0.18 + Math.min(2, behaviorCount(runes, "defense")) * 0.09),
    },
  ];
  scores.sort((left, right) => right.score - left.score);
  const gaps = new Set<BuildArchetypeGap>();

  if (Math.max(scores.find((score) => score.id === "projectileClear")?.score ?? 0, scores.find((score) => score.id === "fireTrail")?.score ?? 0, scores.find((score) => score.id === "chainTrigger")?.score ?? 0) < 0.48) {
    gaps.add("lowClear");
  }
  if ((scores.find((score) => score.id === "bossing")?.score ?? 0) < 0.5) {
    gaps.add("lowBossing");
  }
  if ((scores.find((score) => score.id === "idleSafety")?.score ?? 0) < 0.5) {
    gaps.add("lowSafety");
  }
  if (runes.length > 0 && runeSynergy < 0.67) {
    gaps.add("lowSynergy");
  }
  if (riskPressure > 0.58 || behaviorCount(runes, "risk") > 0) {
    gaps.add("highRisk");
  }

  return {
    primary: scores[0]?.id ?? "idleSafety",
    scores,
    gaps: [...gaps],
  };
}

export type RouteStrategyAction = "locked" | "stabilize" | "farm" | "push" | "duel" | "offline";

export type RouteRewardTarget = "parts" | "forgeMedia" | "keySustain" | "rivalUnique" | "bossFragment" | "atlasProgress";

export type RouteStrategyReason =
  | "locked"
  | "requiresBossGate"
  | "requiresRival"
  | "lowDamage"
  | "lowControl"
  | "fragile"
  | "ringout"
  | "anomaly"
  | "rival"
  | "highReward"
  | "idleReady"
  | "safeFarm";

export type RouteStrategyProjection = {
  action: RouteStrategyAction;
  riskScore: number;
  rewardScore: number;
  idleScore: number;
  clearSpeedScore: number;
  rewardTargets: RouteRewardTarget[];
  offline: {
    killsPerHour: number;
    dropsPerHour: number;
    overflowSalvagePerHour: number;
    capHours: number;
    rivalUniqueDropsBlocked: boolean;
  };
  reasons: RouteStrategyReason[];
};

export type RouteStrategyRecommendationInput = {
  nodes: readonly CircuitNetworkNodeDef[];
  visibleNodeIds: ReadonlySet<string>;
  unlockedNodeIds: ReadonlySet<string>;
  strategyByNodeId: ReadonlyMap<string, RouteStrategyProjection>;
};

export type RouteStrategyRecommendations = {
  offlineNodeId: string | null;
  progressNodeId: string | null;
};

export type RouteStrategyInput = {
  node: CircuitNetworkNodeDef;
  frameId: string;
  driveId: string;
  loadout?: TopLoadoutConfig;
  unlockedNodeIds: ReadonlySet<string>;
  clearedBossGateIds: readonly string[];
  clearedRivalIds: readonly string[];
  partQuantity?: number;
  partRarity?: number;
};

function roundedScore(value: number): number {
  return Math.round(clamp(value, 0, 1) * 1000) / 1000;
}

function anomalyRuleRisk(rule: ReturnType<typeof getArenaAnomalyDef>["playerRule"]): number {
  if (rule === "noFluxSustain") {
    return 0.14;
  }
  if (rule === "shrinkingArena") {
    return 0.11;
  }
  if (rule === "heavyResonance") {
    return 0.09;
  }
  return 0;
}

function roundedRate(value: number): number {
  return Math.round(Math.max(0, value) * 10) / 10;
}

function selectRouteRewardTargets(node: CircuitNetworkNodeDef, arenaTier: number, hasAnomaly: boolean): RouteRewardTarget[] {
  const targets = new Set<RouteRewardTarget>(["parts"]);
  if (arenaTier >= 2 || hasAnomaly) {
    targets.add("forgeMedia");
  }
  if (arenaTier >= 3 || hasAnomaly) {
    targets.add("keySustain");
  }
  if (node.unlocksRivalId) {
    targets.add("rivalUnique");
  }
  if (node.requiredBossGateId || arenaTier >= 4) {
    targets.add("bossFragment");
  }
  if ((node.requiredNodeIds?.length ?? 0) > 0 || arenaTier >= 2) {
    targets.add("atlasProgress");
  }
  return [...targets];
}

function routeStrategyActionPriority(action: RouteStrategyAction): number {
  switch (action) {
    case "duel":
      return 5;
    case "push":
      return 4;
    case "offline":
      return 3;
    case "farm":
      return 2;
    case "stabilize":
      return 1;
    case "locked":
    default:
      return 0;
  }
}

export function selectRouteStrategyProjection({
  node,
  frameId,
  driveId,
  loadout = {},
  unlockedNodeIds,
  clearedBossGateIds,
  clearedRivalIds,
  partQuantity = 0,
  partRarity = 0,
}: RouteStrategyInput): RouteStrategyProjection {
  const unlocked = unlockedNodeIds.has(node.id);
  const missingBossGate = Boolean(node.requiredBossGateId && !clearedBossGateIds.includes(node.requiredBossGateId));
  const missingRival = Boolean(node.requiredRivalId && !clearedRivalIds.includes(node.requiredRivalId));
  const arena = getArenaCircuitDef(node.arenaId);
  const anomaly = node.anomalyId ? getArenaAnomalyDef(node.anomalyId) : null;
  const projectedLoadout = anomaly ? { ...loadout, anomalyId: anomaly.id } : loadout;
  const projection = projectTopCombat({ arenaId: node.arenaId, frameId, driveId, loadout: projectedLoadout });
  const routeAvailable = unlocked && !missingBossGate && !missingRival;
  const tierPressure = clamp((arena.tier - 1) / 4, 0, 1);
  const anomalyRisk = anomaly
    ? clamp((anomaly.enemyIntegrityMultiplier - 1) * 0.55 + (anomaly.enemyImpactMultiplier - 1) * 0.65 + anomalyRuleRisk(anomaly.playerRule), 0, 0.4)
    : 0;
  const missingLayerPressure = projection.missingLayers.length * 0.055;
  const sustainPressure = clamp((1.35 - projection.sustainScore) / 1.35, 0, 1) * 0.14;
  const riskScore = roundedScore(tierPressure * 0.34 + projection.ringOutRisk * 0.24 + missingLayerPressure + sustainPressure + anomalyRisk);
  const clearSpeedScore = roundedScore(projection.totalDps / Math.max(1, arena.enemyIntegrity * 0.42));
  const anomalyReward = anomaly ? anomaly.rewardQuantity + anomaly.rewardRarity : 0;
  const rewardScore = roundedScore(
    clamp((arena.rewardMultiplier - 1) / 0.82, 0, 1) * 0.38 +
      clamp(anomalyReward / 0.78, 0, 1) * 0.34 +
      (node.unlocksRivalId ? 0.1 : 0) +
      (node.requiredBossGateId ? 0.08 : 0) +
      (arena.tier >= 4 ? 0.1 : 0),
  );
  const idleScore = roundedScore(clearSpeedScore * 0.42 + (1 - riskScore) * 0.38 + rewardScore * 0.2 - (anomaly?.playerRule === "noFluxSustain" ? 0.12 : 0));
  const anomalyOfflineScalar = anomaly?.playerRule ? balanceConfig.offline.anomalyRuleRewardScalar : 1;
  const offlineRewardQuantity = (anomaly?.rewardQuantity ?? 0) * anomalyOfflineScalar;
  const enemyEhp = arena.enemyIntegrity + arena.enemyIntegrity * 0.12;
  const survivalFactor = clamp((projection.sustainScore / 1.25) * (1 - projection.ringOutRisk), 0, 1);
  const killsPerHour = routeAvailable ? (projection.totalDps / Math.max(1, enemyEhp)) * survivalFactor * balanceConfig.offline.efficiency * 3600 : 0;
  const dropsPerHour = killsPerHour * dropChanceForArena(node.arenaId, partQuantity, offlineRewardQuantity);
  const capHours = balanceConfig.offline.capSeconds / 3600;
  const overflowSalvagePerHour = Math.max(0, (dropsPerHour * capHours - balanceConfig.offline.dropCap) / capHours);
  const reasons = new Set<RouteStrategyReason>();

  if (!unlocked || missingBossGate || missingRival) {
    reasons.add("locked");
  }
  if (missingBossGate) {
    reasons.add("requiresBossGate");
  }
  if (missingRival) {
    reasons.add("requiresRival");
  }
  if (projection.missingLayers.includes("dps")) {
    reasons.add("lowDamage");
  }
  if (projection.missingLayers.includes("tracking") || projection.missingLayers.includes("grip")) {
    reasons.add("lowControl");
  }
  if (projection.missingLayers.includes("guard") || projection.missingLayers.includes("sustain")) {
    reasons.add("fragile");
  }
  if (projection.ringOutRisk > 0.45) {
    reasons.add("ringout");
  }
  if (anomaly) {
    reasons.add("anomaly");
  }
  if (node.unlocksRivalId && !clearedRivalIds.includes(node.unlocksRivalId)) {
    reasons.add("rival");
  }
  if (rewardScore >= 0.58) {
    reasons.add("highReward");
  }
  if (idleScore >= 0.62) {
    reasons.add("idleReady");
  }
  if (riskScore <= 0.35) {
    reasons.add("safeFarm");
  }

  let action: RouteStrategyAction = "push";
  if (!unlocked || missingBossGate || missingRival) {
    action = "locked";
  } else if (riskScore >= 0.68 || projection.missingLayers.length >= 3) {
    action = "stabilize";
  } else if (node.unlocksRivalId && !clearedRivalIds.includes(node.unlocksRivalId)) {
    action = "duel";
  } else if (idleScore >= 0.62) {
    action = "offline";
  } else if (rewardScore < 0.45 && riskScore <= 0.42) {
    action = "farm";
  }

  return {
    action,
    riskScore,
    rewardScore,
    idleScore,
    clearSpeedScore,
    rewardTargets: selectRouteRewardTargets(node, arena.tier, Boolean(anomaly)),
    offline: {
      killsPerHour: Math.round(Math.max(0, killsPerHour)),
      dropsPerHour: roundedRate(dropsPerHour),
      overflowSalvagePerHour: roundedRate(overflowSalvagePerHour),
      capHours,
      rivalUniqueDropsBlocked: Boolean(node.requiredRivalId || node.unlocksRivalId),
    },
    reasons: [...reasons],
  };
}

export function selectRouteStrategyRecommendations({
  nodes,
  visibleNodeIds,
  unlockedNodeIds,
  strategyByNodeId,
}: RouteStrategyRecommendationInput): RouteStrategyRecommendations {
  const candidates = nodes
    .filter((node) => visibleNodeIds.has(node.id) && unlockedNodeIds.has(node.id))
    .map((node) => ({ node, strategy: strategyByNodeId.get(node.id) }))
    .filter((entry): entry is { node: CircuitNetworkNodeDef; strategy: RouteStrategyProjection } => Boolean(entry.strategy && entry.strategy.action !== "locked"));

  const offlineNodeId =
    [...candidates].sort((left, right) => {
      const leftScore = left.strategy.idleScore * 1000 + left.strategy.offline.dropsPerHour * 0.8 + left.strategy.offline.killsPerHour * 0.04 - left.strategy.riskScore * 180;
      const rightScore = right.strategy.idleScore * 1000 + right.strategy.offline.dropsPerHour * 0.8 + right.strategy.offline.killsPerHour * 0.04 - right.strategy.riskScore * 180;
      return rightScore - leftScore;
    })[0]?.node.id ?? null;

  const progressNodeId =
    [...candidates].sort((left, right) => {
      const leftScore = routeStrategyActionPriority(left.strategy.action) * 1000 + left.strategy.rewardScore * 260 + left.strategy.clearSpeedScore * 160 - left.strategy.riskScore * 220;
      const rightScore = routeStrategyActionPriority(right.strategy.action) * 1000 + right.strategy.rewardScore * 260 + right.strategy.clearSpeedScore * 160 - right.strategy.riskScore * 220;
      return rightScore - leftScore;
    })[0]?.node.id ?? null;

  return { offlineNodeId, progressNodeId };
}

export type DamageBreakdownLine = {
  id: string;
  label: string;
  value: number;
  active: boolean;
  sourceId: string;
  type: TopModifierDef["type"] | "base" | "mitigation" | "crit" | "frequency" | "dps";
  stat?: string;
  condition?: CombatCondition;
};

export type DamageBreakdown = {
  collisionSeed: number;
  flatTotal: number;
  increasedTotal: number;
  reducedTotal: number;
  moreProduct: number;
  lessProduct: number;
  preCritDamage: number;
  rawDamage: number;
  mitigatedDamage: number;
  hitChance: number;
  mitigationMultiplier: number;
  critChance: number;
  critExpectedMultiplier: number;
  attackFrequency: number;
  collisionDps: number;
  driveDps: number;
  dotDps: number;
  totalDps: number;
  targetName?: string;
  lines: DamageBreakdownLine[];
};

export type DpsBreakdownProjectionInput = {
  arenaId: string;
  frameId: string;
  driveId: string;
  loadout?: TopLoadoutConfig;
  targetStats?: TopRuntimeStats;
  targetName?: string;
};

export type BreakpointStatus = {
  id: string;
  sourceId: string;
  attr: Extract<CombatCondition, { kind: "attr" }>["attr"];
  op: Extract<CombatCondition, { kind: "attr" }>["op"];
  value: number;
  currentValue: number;
  delta: number;
  triggered: boolean;
  penalty: boolean;
};

export type EquipCompareLine = {
  stat: keyof Pick<TopRuntimeStats, "maxSpinIntegrity" | "maxFluxGuard" | "guard" | "drift" | "tracking" | "impact" | "rpm" | "mass" | "grip" | "edge" | "fracture" | "resonance" | "partQuantity" | "partRarity">;
  currentValue: number;
  previewValue: number;
  delta: number;
};

export type EquipThresholdCrossing = {
  id: string;
  sourceId: string;
  attr: BreakpointStatus["attr"];
  currentTriggered: boolean;
  previewTriggered: boolean;
};

export type EquipCompare = {
  lines: EquipCompareLine[];
  thresholdCrossings: EquipThresholdCrossing[];
};

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

function combatContextForStats(stats: TopRuntimeStats): CombatContext {
  const physics = resolveStatsPhysics(stats);
  return {
    physics,
    spinEnergyRatio: 1,
    fluxRatio: 1,
    omega: physics.omega,
    events: [],
  };
}

function driveForEntity(entity: TopRuntimeEntity, fallbackDriveId?: string): DriveCoreDef {
  return getDriveCoreDef(fallbackDriveId ?? entity.driveId ?? "drive_shard_barrage");
}

function modifierTagsApply(modifier: TopModifierDef, tags: string[]): boolean {
  return !modifier.tags || modifier.tags.length === 0 || modifier.tags.some((tag) => tags.includes(tag));
}

function modifierAffectsDamageBreakdown(modifier: TopModifierDef): boolean {
  return (
    modifier.stat === "damage" ||
    modifier.stat === "impact" ||
    modifier.stat === "edge" ||
    modifier.stat === "fracture" ||
    modifier.type === "conversion" ||
    modifier.type === "extraAs" ||
    modifier.type === "penetration"
  );
}

function sumDamagePacket(packet: Record<string, number>): number {
  return Object.values(packet).reduce((sum, value) => sum + value, 0);
}

function scaleDotDpsForTarget(baseDps: number, damageType: keyof DamagePacket, attacker: TopRuntimeStats, defender: TopRuntimeStats): number {
  const increased = attacker.modifiers
    .filter((modifier) => (modifier.stat === damageType || modifier.stat === "damage") && modifier.type === "increased")
    .reduce((sum, modifier) => sum + modifier.value, 0);
  const more = attacker.modifiers
    .filter((modifier) => (modifier.stat === damageType || modifier.stat === "damage") && modifier.type === "more")
    .reduce((product, modifier) => product * (1 + modifier.value), 1);
  const resistance = clamp(defender.resistances[damageType] ?? 0, -0.75, 0.9);
  return baseDps * (1 + increased) * more * (1 - resistance);
}

function collectAttrConditions(condition: CombatCondition | undefined): Extract<CombatCondition, { kind: "attr" }>[] {
  if (!condition) {
    return [];
  }
  if (condition.kind === "attr") {
    return [condition];
  }
  if (condition.kind === "and" || condition.kind === "or") {
    return condition.terms.flatMap(collectAttrConditions);
  }
  return [];
}

function breakpointDelta(currentValue: number, op: BreakpointStatus["op"], value: number): number {
  if (op === ">=" || op === ">") {
    return Math.max(0, value - currentValue);
  }
  if (op === "<=" || op === "<") {
    return Math.max(0, currentValue - value);
  }
  return Math.abs(currentValue - value);
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

export function selectDpsBreakdown(entity: TopRuntimeEntity, events: CombatEvent[] = [], driveId?: string, projectionInput?: DpsBreakdownProjectionInput): DamageBreakdown {
  const context = combatContextForSelector(entity, events);
  const physics = context.physics;
  const drive = driveForEntity(entity, driveId);
  const tags = drive.tags;
  const modifiers = [...entity.stats.modifiers, ...drive.modifiers].filter(modifierAffectsDamageBreakdown);
  const collisionPacket = createCollisionPacket(entity.stats);
  const collisionSeed = collisionPacket.impact;
  const attackFrequency = physics.attackFrequency;
  const lines: DamageBreakdownLine[] = [
    {
      id: "base_collision_seed",
      label: "base",
      value: collisionSeed,
      active: true,
      sourceId: "base",
      type: "base",
      stat: "impact",
    },
  ];

  let flatTotal = 0;
  let increasedTotal = 0;
  let reducedTotal = 0;
  let moreProduct = 1;
  let lessProduct = 1;
  let edgeFlat = 0;

  for (const modifier of modifiers) {
    const tagActive = modifierTagsApply(modifier, tags);
    const conditionActive = evaluateCombatCondition(modifier.condition, context);
    const active = tagActive && conditionActive;
    const line: DamageBreakdownLine = {
      id: modifier.id,
      label: modifier.id,
      value: modifier.value,
      active,
      sourceId: modifier.id,
      type: modifier.type,
      stat: modifier.stat,
      condition: modifier.condition,
    };
    lines.push(line);

    if (!active) {
      continue;
    }
    const affectsImpact = modifier.stat === "impact" || modifier.stat === "damage";
    if (modifier.type === "flat" && modifier.stat === "impact") {
      flatTotal += modifier.value;
    }
    if (modifier.type === "flat" && modifier.stat === "edge") {
      edgeFlat += modifier.value;
    }
    if (modifier.type === "increased" && affectsImpact) {
      increasedTotal += modifier.value;
    }
    if (modifier.type === "reduced" && affectsImpact) {
      reducedTotal += modifier.value;
    }
    if (modifier.type === "more" && affectsImpact) {
      moreProduct *= 1 + modifier.value;
    }
    if (modifier.type === "less" && affectsImpact) {
      lessProduct *= Math.max(0, 1 - modifier.value);
    }
  }

  const defender = projectionInput?.targetStats ?? createProjectionEnemyStats(projectionInput?.arenaId ?? "arena_cinder_crucible");
  const collisionHit = resolveTopHit({
    baseDamage: collisionPacket,
    attacker: entity.stats,
    defender,
    drive,
    sourceTags: ["attack", "melee"],
    context,
  });
  const driveHit = resolveTopHit({
    baseDamage: drive.hit?.damage ?? drive.baseDamage,
    attacker: entity.stats,
    defender,
    drive,
    sourceTags: drive.tags,
    context,
    hitFlags: drive.hit ? { usesTracking: drive.hit.usesTracking, canCrit: drive.hit.canCrit } : undefined,
  });
  const rawDamage = sumDamagePacket(collisionHit.rawDamage);
  const mitigatedDamage = collisionHit.totalDamage;
  const preCritDamage = rawDamage;
  const critChance = collisionHit.critChance;
  const critExpectedMultiplier = collisionHit.expectedCritMultiplier;
  const effectiveCooldown = effectiveCooldownFromOmega(drive.cooldown?.baseSeconds ?? drive.baseCooldown, physics.omega, entity.stats.resonance, entity.stats.cooldownRecovery ?? 0);
  const projected = projectionInput && !projectionInput.targetStats
    ? projectTopCombat({
        arenaId: projectionInput.arenaId,
        frameId: projectionInput.frameId,
        driveId: projectionInput.driveId,
        loadout: projectionInput.loadout,
      })
    : null;
  const collisionDps = projected?.collisionDps ?? collisionHit.totalDamage * Math.max(0.25, attackFrequency);
  const driveDps = projected?.driveDps ?? driveHit.totalDamage / Math.max(0.25, effectiveCooldown);
  const dotDps = projected?.dotDps ?? (drive.dot ? scaleDotDpsForTarget(drive.dot.baseDps, drive.dot.damageType, entity.stats, defender) : 0);
  const totalDps = projected?.totalDps ?? collisionDps + driveDps + dotDps;
  lines.push(
    {
      id: "crit_expected_value",
      label: "crit",
      value: critExpectedMultiplier,
      active: true,
      sourceId: "crit",
      type: "crit",
      stat: "edge",
    },
    {
      id: "attack_frequency",
      label: "frequency",
      value: attackFrequency,
      active: true,
      sourceId: "omega",
      type: "frequency",
      stat: "omega",
    },
    {
      id: "collision_dps",
      label: "dps",
      value: collisionDps,
      active: true,
      sourceId: "dps",
      type: "dps",
    },
    {
      id: "drive_dps",
      label: "drive_dps",
      value: driveDps,
      active: true,
      sourceId: drive.id,
      type: "dps",
    },
    {
      id: "dot_dps",
      label: "dot_dps",
      value: dotDps,
      active: Boolean(dotDps),
      sourceId: drive.id,
      type: "dps",
    },
  );

  return {
    collisionSeed,
    flatTotal,
    increasedTotal,
    reducedTotal,
    moreProduct,
    lessProduct,
    preCritDamage,
    rawDamage,
    mitigatedDamage,
    hitChance: collisionHit.hitChance,
    mitigationMultiplier: rawDamage > 0 ? mitigatedDamage / rawDamage : 1,
    critChance,
    critExpectedMultiplier,
    attackFrequency,
    collisionDps,
    driveDps,
    dotDps,
    totalDps,
    targetName: projectionInput?.targetName,
    lines,
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

export function selectBreakpointStatus(entity: TopRuntimeEntity, driveId: string, events: CombatEvent[] = []): BreakpointStatus[] {
  const context = combatContextForSelector(entity, events);
  const drive = getDriveCoreDef(driveId);
  const statuses: BreakpointStatus[] = [];
  const pushCondition = (id: string, sourceId: string, condition: Extract<CombatCondition, { kind: "attr" }>, penalty: boolean) => {
    const currentValue = attrValueForCondition(context, condition.attr);
    statuses.push({
      id,
      sourceId,
      attr: condition.attr,
      op: condition.op,
      value: condition.value,
      currentValue,
      delta: breakpointDelta(currentValue, condition.op, condition.value),
      triggered: evaluateCombatCondition(condition, context),
      penalty,
    });
  };

  for (const requirement of drive.requiredAttributes ?? []) {
    pushCondition(`drive_gate_${requirement.attr}_${requirement.op}_${requirement.value}`, drive.id, requirement, true);
  }

  for (const modifier of [...entity.stats.modifiers, ...drive.modifiers]) {
    for (const condition of collectAttrConditions(modifier.condition)) {
      pushCondition(modifier.id, modifier.id, condition, modifier.type === "less" || modifier.value < 0);
    }
  }

  const seen = new Set<string>();
  return statuses.filter((status) => {
    const key = `${status.id}_${status.attr}_${status.op}_${status.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function selectEquipCompare(currentStats: TopRuntimeStats, previewStats: TopRuntimeStats, driveId: string): EquipCompare {
  const statsToCompare: EquipCompareLine["stat"][] = [
    "maxSpinIntegrity",
    "maxFluxGuard",
    "guard",
    "drift",
    "tracking",
    "impact",
    "rpm",
    "mass",
    "grip",
    "edge",
    "fracture",
    "resonance",
    "partQuantity",
    "partRarity",
  ];
  const currentContext = combatContextForStats(currentStats);
  const previewContext = combatContextForStats(previewStats);
  const drive = getDriveCoreDef(driveId);
  const thresholdCrossings: EquipThresholdCrossing[] = [];
  const pushCrossing = (id: string, sourceId: string, condition: Extract<CombatCondition, { kind: "attr" }>) => {
    const currentTriggered = evaluateCombatCondition(condition, currentContext);
    const previewTriggered = evaluateCombatCondition(condition, previewContext);
    if (currentTriggered !== previewTriggered) {
      thresholdCrossings.push({ id, sourceId, attr: condition.attr, currentTriggered, previewTriggered });
    }
  };

  for (const requirement of drive.requiredAttributes ?? []) {
    pushCrossing(`drive_gate_${drive.id}_${requirement.attr}`, drive.id, requirement);
  }
  for (const modifier of [...currentStats.modifiers, ...previewStats.modifiers, ...drive.modifiers]) {
    for (const condition of collectAttrConditions(modifier.condition)) {
      pushCrossing(modifier.id, modifier.id, condition);
    }
  }

  return {
    lines: statsToCompare.map((stat) => {
      const currentValue = currentStats[stat] ?? 0;
      const previewValue = previewStats[stat] ?? 0;
      return {
        stat,
        currentValue,
        previewValue,
        delta: previewValue - currentValue,
      };
    }),
    thresholdCrossings,
  };
}
