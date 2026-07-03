import { balanceConfig } from "../../data/balanceConfig";
import { getDriveCoreDef } from "../../data/driveCores";
import { tutorialSteps, type TutorialTrigger } from "../../data/tutorialSteps";
import { attrValueForCondition, evaluateCombatCondition, type CombatContext } from "../../engine/conditionEval";
import { evaluateDriveGate, type DriveGateStatus } from "../../engine/driveGate";
import { clamp } from "../../engine/math";
import { createCollisionPacket, createProjectionEnemyStats, projectTopCombat } from "../../engine/topCombat";
import { resolveTopHit } from "../../engine/topDamage";
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
