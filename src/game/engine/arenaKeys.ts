import { arenaKeyAffixes } from "../data/arenaKeyAffixes";
import { getArenaCircuitDef } from "../data/arenaCircuits";
import { createRng, type Rng } from "./rng";
import type { ArenaKey, ArenaKeyAffix, ArenaKeyAffixDef, ArenaKeyRarity, ArenaRewardBias, TopAffixSlot } from "./topTypes";

export const ARENA_KEY_BALANCE_VERSION = "arena-keys-v1";

type GenerateArenaKeyOptions = {
  id?: string;
  arenaBaseId: string;
  tier: number;
  seed: string;
  rarity?: ArenaKeyRarity;
  itemLevel?: number;
  quality?: number;
  bossGateId?: string;
};

type ArenaKeyRiskReward = {
  enemyIntegrityMultiplier: number;
  enemyImpactMultiplier: number;
  enemyGuardMultiplier: number;
  enemyRpmMultiplier: number;
  rewardQuantity: number;
  rewardRarity: number;
  bossPressure: number;
  rewardBias: ArenaRewardBias[];
};

function chooseArenaKeyRarity(rng: Rng): ArenaKeyRarity {
  const roll = rng.next();
  if (roll < 0.015) {
    return "relic";
  }
  if (roll < 0.12) {
    return "engraved";
  }
  if (roll < 0.48) {
    return "tuned";
  }
  return "common";
}

function affixCountForRarity(rarity: ArenaKeyRarity, rng: Rng): number {
  if (rarity === "common") {
    return 0;
  }
  if (rarity === "tuned") {
    return rng.int(1, 2);
  }
  if (rarity === "engraved") {
    return rng.int(3, 4);
  }
  return 5;
}

function rollAffix(def: ArenaKeyAffixDef, tier: number): ArenaKeyAffix {
  const tierScalar = 1 + Math.max(0, tier - def.minTier) * 0.08;
  return {
    affixId: def.id,
    displayName: def.displayName,
    slot: def.slot,
    group: def.group,
    tier,
    enemyIntegrityMultiplier: def.enemyIntegrityMultiplier ? Math.round(def.enemyIntegrityMultiplier * tierScalar * 1000) / 1000 : 1,
    enemyImpactMultiplier: def.enemyImpactMultiplier ? Math.round(def.enemyImpactMultiplier * tierScalar * 1000) / 1000 : 1,
    enemyGuardMultiplier: def.enemyGuardMultiplier ? Math.round(def.enemyGuardMultiplier * tierScalar * 1000) / 1000 : 1,
    enemyRpmMultiplier: def.enemyRpmMultiplier ? Math.round(def.enemyRpmMultiplier * tierScalar * 1000) / 1000 : 1,
    rewardQuantity: def.rewardQuantity ? Math.round(def.rewardQuantity * tierScalar * 1000) / 1000 : 0,
    rewardRarity: def.rewardRarity ? Math.round(def.rewardRarity * tierScalar * 1000) / 1000 : 0,
    bossPressure: def.bossPressure ? Math.round(def.bossPressure * tierScalar * 1000) / 1000 : 0,
    rewardBias: def.rewardBias ?? [],
  };
}

function chooseAffixes(rng: Rng, tier: number, rarity: ArenaKeyRarity): ArenaKeyAffix[] {
  const usedGroups = new Set<string>();
  const affixes: ArenaKeyAffix[] = [];
  let prefixCount = 0;
  let suffixCount = 0;
  const targetCount = affixCountForRarity(rarity, rng);

  while (affixes.length < targetCount) {
    const candidates = arenaKeyAffixes.filter((affix) => {
      if (affix.minTier > tier || usedGroups.has(affix.group)) {
        return false;
      }
      if (affix.slot === "prefix" && prefixCount >= 3) {
        return false;
      }
      if (affix.slot === "suffix" && suffixCount >= 3) {
        return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      break;
    }

    const affix = rollAffix(rng.weighted(candidates, (candidate) => candidate.weight), tier);
    affixes.push(affix);
    usedGroups.add(affix.group);
    if (affix.slot === "prefix") {
      prefixCount += 1;
    } else {
      suffixCount += 1;
    }
  }

  return affixes;
}

function splitAffixes(affixes: ArenaKeyAffix[], slot: TopAffixSlot): ArenaKeyAffix[] {
  return affixes.filter((affix) => affix.slot === slot);
}

export function generateArenaKey(options: GenerateArenaKeyOptions): ArenaKey {
  const rng = createRng(options.seed);
  const arena = getArenaCircuitDef(options.arenaBaseId);
  const rarity = options.rarity ?? chooseArenaKeyRarity(rng);
  const itemLevel = options.itemLevel ?? Math.max(arena.enemyLevel, options.tier * 3);
  const affixes = chooseAffixes(rng, options.tier, rarity);

  return {
    id: options.id ?? `arena_key_${options.arenaBaseId}_${options.seed}`,
    tier: options.tier,
    arenaBaseId: options.arenaBaseId,
    rarity,
    itemLevel,
    quality: options.quality ?? 0,
    prefixes: splitAffixes(affixes, "prefix"),
    suffixes: splitAffixes(affixes, "suffix"),
    rewardBias: affixes.flatMap((affix) => affix.rewardBias),
    bossGateId: options.bossGateId,
    generatedAt: new Date(0).toISOString(),
    generatedBy: {
      arenaId: options.arenaBaseId,
      balanceVersion: ARENA_KEY_BALANCE_VERSION,
      seed: options.seed,
    },
  };
}

export function summarizeArenaKeyRiskReward(key: ArenaKey): ArenaKeyRiskReward {
  const affixes = [...key.prefixes, ...key.suffixes];
  const qualityReward = key.quality / 100;

  return affixes.reduce<ArenaKeyRiskReward>(
    (summary, affix) => ({
      enemyIntegrityMultiplier: Math.round(summary.enemyIntegrityMultiplier * affix.enemyIntegrityMultiplier * 1000) / 1000,
      enemyImpactMultiplier: Math.round(summary.enemyImpactMultiplier * affix.enemyImpactMultiplier * 1000) / 1000,
      enemyGuardMultiplier: Math.round(summary.enemyGuardMultiplier * affix.enemyGuardMultiplier * 1000) / 1000,
      enemyRpmMultiplier: Math.round(summary.enemyRpmMultiplier * affix.enemyRpmMultiplier * 1000) / 1000,
      rewardQuantity: Math.round((summary.rewardQuantity + affix.rewardQuantity) * 1000) / 1000,
      rewardRarity: Math.round((summary.rewardRarity + affix.rewardRarity) * 1000) / 1000,
      bossPressure: Math.round((summary.bossPressure + affix.bossPressure) * 1000) / 1000,
      rewardBias: [...summary.rewardBias, ...affix.rewardBias],
    }),
    {
      enemyIntegrityMultiplier: 1,
      enemyImpactMultiplier: 1,
      enemyGuardMultiplier: 1,
      enemyRpmMultiplier: 1,
      rewardQuantity: qualityReward,
      rewardRarity: qualityReward * 0.5,
      bossPressure: 0,
      rewardBias: [],
    },
  );
}

export function isArenaKeyLegal(key: ArenaKey): boolean {
  const affixes = [...key.prefixes, ...key.suffixes];
  const groups = new Set<string>();
  const prefixCount = key.prefixes.length;
  const suffixCount = key.suffixes.length;

  for (const affix of affixes) {
    if (groups.has(affix.group)) {
      return false;
    }
    groups.add(affix.group);
  }

  return prefixCount <= 3 && suffixCount <= 3;
}
