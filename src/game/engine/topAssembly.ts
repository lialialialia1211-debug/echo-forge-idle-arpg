import { getDriveCoreDef } from "../data/driveCores";
import { resolveCircuitAtlasBonuses } from "../data/circuitAtlasNodes";
import { resolveDoctrineBonuses } from "../data/doctrines";
import { getTalentNodeDef } from "../data/talentNodes";
import { getTopFrameDef } from "../data/topFrames";
import { getTopPartBaseDef } from "../data/topPartBases";
import { getTuningRuneDef } from "../data/tuningRunes";
import { validateRuneLoadout } from "./driveRuneValidation";
import type { DriveTag, TopLoadoutConfig, TopModifierDef, TopResistanceBlock, TopRuntimeStats, TopStatBlock, TopStatId } from "./topTypes";
import { zeroResistances } from "./topTypes";

type LoadoutBonuses = {
  statBonuses: TopStatBlock;
  resistanceBonuses: TopResistanceBlock;
  modifiers: TopModifierDef[];
};

function addStats(a: TopStatBlock = {}, b: TopStatBlock = {}): TopStatBlock {
  const next: TopStatBlock = { ...a };
  for (const [stat, value] of Object.entries(b)) {
    next[stat as keyof TopStatBlock] = (next[stat as keyof TopStatBlock] ?? 0) + (value ?? 0);
  }
  return next;
}

function addResistances(a: TopResistanceBlock = {}, b: TopResistanceBlock = {}): TopResistanceBlock {
  const next: TopResistanceBlock = { ...a };
  for (const [type, value] of Object.entries(b)) {
    next[type as keyof TopResistanceBlock] = (next[type as keyof TopResistanceBlock] ?? 0) + (value ?? 0);
  }
  return next;
}

function cloneModifiers(modifiers: TopModifierDef[] = [], suffix: string): TopModifierDef[] {
  return modifiers.map((modifier) => ({ ...modifier, id: `${modifier.id}_${suffix}` }));
}

const topStatIds = new Set<TopStatId>([
  "spinIntegrity",
  "fluxGuard",
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
  "fluxCost",
  "cooldownRecovery",
  "reservationEfficiency",
  "stagger",
  "ringOutPressure",
  "partQuantity",
  "partRarity",
]);

function isTopStatId(stat: TopModifierDef["stat"]): stat is TopStatId {
  return topStatIds.has(stat as TopStatId);
}

function localModifierMatchesTags(modifier: TopModifierDef, partTags: DriveTag[]): boolean {
  return !modifier.tags || modifier.tags.length === 0 || modifier.tags.some((tag) => partTags.includes(tag));
}

function applyLocalStatModifiers(stats: TopStatBlock = {}, modifiers: TopModifierDef[] = [], partTags: DriveTag[] = []): TopStatBlock {
  let next: TopStatBlock = { ...stats };

  for (const modifier of modifiers) {
    if (!isTopStatId(modifier.stat) || !localModifierMatchesTags(modifier, partTags)) {
      continue;
    }
    const current = next[modifier.stat] ?? 0;
    if (modifier.type === "flat") {
      next = { ...next, [modifier.stat]: current + modifier.value };
    } else if (modifier.type === "increased" || modifier.type === "more") {
      next = { ...next, [modifier.stat]: current * (1 + modifier.value) };
    } else if (modifier.type === "reduced" || modifier.type === "less") {
      next = { ...next, [modifier.stat]: current * Math.max(0, 1 - modifier.value) };
    }
  }

  return next;
}

export function resolveTopLoadoutBonuses(loadout: TopLoadoutConfig = {}, driveId = "drive_shard_barrage"): LoadoutBonuses {
  let statBonuses: TopStatBlock = {};
  let resistanceBonuses: TopResistanceBlock = {};
  let modifiers: TopModifierDef[] = [];

  for (const part of Object.values(loadout.equipment ?? {})) {
    if (!part) {
      continue;
    }
    const partBase = getTopPartBaseDef(part.baseId);
    const partModifiers = cloneModifiers(part.modifiers, part.id);
    const localModifiers = partModifiers.filter((modifier) => modifier.scope === "local");
    const globalModifiers = partModifiers.filter((modifier) => modifier.scope !== "local");
    statBonuses = addStats(statBonuses, applyLocalStatModifiers(part.statBonuses, localModifiers, partBase.tags));
    resistanceBonuses = addResistances(resistanceBonuses, part.resistanceBonuses);
    modifiers = [...modifiers, ...globalModifiers];
  }

  for (const runeId of validateRuneLoadout(driveId, loadout.runeIds ?? []).validRuneIds) {
    const rune = getTuningRuneDef(runeId);
    statBonuses = addStats(statBonuses, rune.statBonuses);
    resistanceBonuses = addResistances(resistanceBonuses, rune.resistanceBonuses);
    modifiers = [...modifiers, ...cloneModifiers(rune.modifiers, rune.id)];
  }

  for (const talentId of loadout.talentIds ?? []) {
    const talent = getTalentNodeDef(talentId);
    statBonuses = addStats(statBonuses, talent.statBonuses);
    resistanceBonuses = addResistances(resistanceBonuses, talent.resistanceBonuses);
    modifiers = [...modifiers, ...cloneModifiers(talent.modifiers, talent.id)];
  }

  const atlasBonuses = resolveCircuitAtlasBonuses(loadout.circuitAtlasNodeIds ?? []);
  statBonuses = addStats(statBonuses, atlasBonuses.statBonuses);
  resistanceBonuses = addResistances(resistanceBonuses, atlasBonuses.resistanceBonuses);
  modifiers = [...modifiers, ...cloneModifiers(atlasBonuses.modifiers, "circuit_atlas")];

  const doctrineBonuses = resolveDoctrineBonuses(loadout.doctrineId);
  statBonuses = addStats(statBonuses, doctrineBonuses.statBonuses);
  resistanceBonuses = addResistances(resistanceBonuses, doctrineBonuses.resistanceBonuses);
  modifiers = [...modifiers, ...cloneModifiers(doctrineBonuses.modifiers, loadout.doctrineId ?? "doctrine")];

  return { statBonuses, resistanceBonuses, modifiers };
}

function applyStatBonuses(stats: TopRuntimeStats, bonuses: TopStatBlock): TopRuntimeStats {
  return {
    ...stats,
    maxSpinIntegrity: stats.maxSpinIntegrity + (bonuses.spinIntegrity ?? 0),
    maxFluxGuard: stats.maxFluxGuard + (bonuses.fluxGuard ?? 0),
    guard: stats.guard + (bonuses.guard ?? 0),
    drift: stats.drift + (bonuses.drift ?? 0),
    tracking: stats.tracking + (bonuses.tracking ?? 0),
    impact: stats.impact + (bonuses.impact ?? 0),
    rpm: stats.rpm + (bonuses.rpm ?? 0),
    mass: stats.mass + (bonuses.mass ?? 0),
    grip: stats.grip + (bonuses.grip ?? 0),
    edge: stats.edge + (bonuses.edge ?? 0),
    fracture: stats.fracture + (bonuses.fracture ?? 0),
    resonance: stats.resonance + (bonuses.resonance ?? 0),
    fluxCost: (stats.fluxCost ?? 0) + (bonuses.fluxCost ?? 0),
    cooldownRecovery: (stats.cooldownRecovery ?? 0) + (bonuses.cooldownRecovery ?? 0),
    reservationEfficiency: (stats.reservationEfficiency ?? 0) + (bonuses.reservationEfficiency ?? 0),
    stagger: (stats.stagger ?? 0) + (bonuses.stagger ?? 0),
    ringOutPressure: (stats.ringOutPressure ?? 0) + (bonuses.ringOutPressure ?? 0),
    partQuantity: stats.partQuantity + (bonuses.partQuantity ?? 0),
    partRarity: stats.partRarity + (bonuses.partRarity ?? 0),
  };
}

export function resolveTopRuntimeStats(frameId: string, driveId: string, loadout: TopLoadoutConfig = {}): TopRuntimeStats {
  const frame = getTopFrameDef(frameId);
  const drive = getDriveCoreDef(driveId);
  const tagMatchBonus = drive.tags.filter((tag) => frame.preferredTags.includes(tag)).length * 0.035;
  const loadoutBonuses = resolveTopLoadoutBonuses(loadout, driveId);

  const baseStats: TopRuntimeStats = {
    ...frame.baseStats,
    impact: frame.baseStats.impact * (1 + tagMatchBonus),
    rpm: frame.baseStats.rpm * (1 + tagMatchBonus * 0.5),
    partQuantity: 0.08,
    partRarity: 0.04 + tagMatchBonus,
    resistances: {
      ...zeroResistances(),
      impact: 0,
      heat: frame.id === "frame_ember_crucible" ? 0.22 : 0.08,
      glass: 0.06,
      static: frame.id === "frame_storm_needle" ? 0.2 : 0.06,
      void: 0.02,
    },
    modifiers: loadoutBonuses.modifiers,
  };

  const stats = applyStatBonuses(baseStats, loadoutBonuses.statBonuses);
  return {
    ...stats,
    resistances: {
      impact: stats.resistances.impact + (loadoutBonuses.resistanceBonuses.impact ?? 0),
      heat: stats.resistances.heat + (loadoutBonuses.resistanceBonuses.heat ?? 0),
      glass: stats.resistances.glass + (loadoutBonuses.resistanceBonuses.glass ?? 0),
      static: stats.resistances.static + (loadoutBonuses.resistanceBonuses.static ?? 0),
      void: stats.resistances.void + (loadoutBonuses.resistanceBonuses.void ?? 0),
    },
  };
}
