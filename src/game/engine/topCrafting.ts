import { topEngravings } from "../data/engravings";
import { getTopPartBaseDef } from "../data/topPartBases";
import { createRng } from "./rng";
import {
  assembleTopPartFromAffixes,
  generateTopPart,
  getEligibleTopEngravings,
  TOP_PART_BALANCE_VERSION,
} from "./topPartGeneration";
import type { TopPartGeneratedBy, TopPartInstance, TopPartRarity, TopRolledEngraving } from "./topTypes";

export type TopForgeWallet = {
  ash: number;
  glass: number;
  echo: number;
};

export type TopCraftResult = {
  part: TopPartInstance;
  spent: TopForgeWallet;
};

const zeroWallet: TopForgeWallet = { ash: 0, glass: 0, echo: 0 };
const rarityOrder: TopPartRarity[] = ["common", "tuned", "engraved", "relic"];

function craftProvenance(part: TopPartInstance, seed: string): TopPartGeneratedBy {
  return {
    arenaId: part.generatedBy?.arenaId ?? "craft",
    enemyLevel: part.generatedBy?.enemyLevel ?? part.itemLevel,
    balanceVersion: TOP_PART_BALANCE_VERSION,
    seed,
    source: "craft",
  };
}

function withAffixes(part: TopPartInstance, affixes: TopRolledEngraving[], seed: string): TopPartInstance {
  return assembleTopPartFromAffixes({
    id: `${part.id}_${seed}`,
    base: getTopPartBaseDef(part.baseId),
    rarity: part.rarity,
    itemLevel: part.itemLevel,
    affixes,
    generatedBy: craftProvenance(part, seed),
    locked: part.locked,
    sourceDropId: part.sourceDropId,
  });
}

function nextRarity(rarity: TopPartRarity): TopPartRarity {
  const index = rarityOrder.indexOf(rarity);
  return rarityOrder[Math.min(rarityOrder.length - 1, index + 1)];
}

export function salvageTopPart(part: TopPartInstance): TopForgeWallet {
  if (part.locked) {
    throw new Error("Locked top parts cannot be salvaged.");
  }
  if (part.rarity === "relic") {
    return { ash: 16, glass: 4, echo: 1 };
  }
  if (part.rarity === "engraved") {
    return { ash: 8, glass: 2, echo: 0 };
  }
  if (part.rarity === "tuned") {
    return { ash: 4, glass: 1, echo: 0 };
  }
  return { ash: 2, glass: 0, echo: 0 };
}

export function upgradeTopPartRarity(part: TopPartInstance, seed: string): TopCraftResult {
  const rarity = nextRarity(part.rarity);
  return {
    spent: { ash: rarity === "relic" ? 18 : 6, glass: rarity === "relic" ? 5 : 1, echo: rarity === "relic" ? 1 : 0 },
    part: generateTopPart({
      id: `${part.id}_upgrade_${seed}`,
      baseId: part.baseId,
      rarity,
      itemLevel: part.itemLevel,
      seed,
      arenaId: part.generatedBy?.arenaId ?? "craft",
      enemyLevel: part.generatedBy?.enemyLevel ?? part.itemLevel,
      source: "craft",
      locked: part.locked,
    }),
  };
}

export function rerollTopPartAffixes(part: TopPartInstance, seed: string): TopCraftResult {
  return {
    spent: { ash: 3, glass: 2, echo: 0 },
    part: generateTopPart({
      id: `${part.id}_reroll_${seed}`,
      baseId: part.baseId,
      rarity: part.rarity,
      itemLevel: part.itemLevel,
      seed,
      arenaId: part.generatedBy?.arenaId ?? "craft",
      enemyLevel: part.generatedBy?.enemyLevel ?? part.itemLevel,
      source: "craft",
      locked: part.locked,
    }),
  };
}

export function rerollTopPartValues(part: TopPartInstance, seed: string): TopCraftResult {
  return {
    spent: { ash: 0, glass: 2, echo: 0 },
    part: generateTopPart({
      id: `${part.id}_values_${seed}`,
      baseId: part.baseId,
      rarity: part.rarity,
      itemLevel: part.itemLevel,
      seed,
      arenaId: part.generatedBy?.arenaId ?? "craft",
      enemyLevel: part.generatedBy?.enemyLevel ?? part.itemLevel,
      source: "craft",
      locked: part.locked,
      affixIds: (part.affixes ?? []).map((affix) => affix.engravingId),
      exactAffixIds: true,
    }),
  };
}

export function addRandomEngraving(part: TopPartInstance, seed: string): TopCraftResult {
  const base = getTopPartBaseDef(part.baseId);
  const currentAffixes = part.affixes ?? [];
  if (currentAffixes.length >= 6) {
    return { spent: zeroWallet, part };
  }

  const usedGroups = new Set(currentAffixes.map((affix) => affix.group));
  const prefixCount = currentAffixes.filter((affix) => affix.slot === "prefix").length;
  const suffixCount = currentAffixes.filter((affix) => affix.slot === "suffix").length;
  const candidates = getEligibleTopEngravings(base, part.itemLevel, usedGroups).filter((engraving) => {
    if (engraving.slot === "prefix" && prefixCount >= 3) {
      return false;
    }
    if (engraving.slot === "suffix" && suffixCount >= 3) {
      return false;
    }
    return true;
  });

  if (candidates.length === 0) {
    return { spent: zeroWallet, part };
  }

  const rng = createRng(seed);
  const added = rng.weighted(candidates, (engraving) => engraving.weight);
  const next = generateTopPart({
    id: `${part.id}_add_${seed}`,
    baseId: part.baseId,
    rarity: part.rarity,
    itemLevel: part.itemLevel,
    seed,
    arenaId: part.generatedBy?.arenaId ?? "craft",
    enemyLevel: part.generatedBy?.enemyLevel ?? part.itemLevel,
    source: "craft",
    locked: part.locked,
    affixIds: [...currentAffixes.map((affix) => affix.engravingId), added.id],
    exactAffixIds: true,
  });

  return {
    spent: { ash: 8, glass: 0, echo: 0 },
    part: next,
  };
}

export function removeRandomEngraving(part: TopPartInstance, seed: string): TopCraftResult {
  const currentAffixes = part.affixes ?? [];
  if (currentAffixes.length === 0) {
    return { spent: zeroWallet, part };
  }

  const rng = createRng(seed);
  const removeIndex = rng.int(0, currentAffixes.length - 1);
  return {
    spent: { ash: 0, glass: 0, echo: 1 },
    part: withAffixes(
      part,
      currentAffixes.filter((_, index) => index !== removeIndex),
      seed,
    ),
  };
}

export function isTopPartLegal(part: TopPartInstance): boolean {
  const base = getTopPartBaseDef(part.baseId);
  const affixes = part.affixes ?? [];
  const groups = new Set<string>();
  let prefixCount = 0;
  let suffixCount = 0;

  for (const affix of affixes) {
    const source = topEngravings.find((entry) => entry.id === affix.engravingId);
    if (!source) {
      return false;
    }
    if (source.slots && !source.slots.includes(base.slot)) {
      return false;
    }
    if (groups.has(affix.group)) {
      return false;
    }
    groups.add(affix.group);
    if (affix.slot === "prefix") {
      prefixCount += 1;
    } else {
      suffixCount += 1;
    }
  }

  return prefixCount <= 3 && suffixCount <= 3;
}
