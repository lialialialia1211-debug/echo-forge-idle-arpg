import { affixes } from "../data/affixes";
import { getAreaDef } from "../data/areas";
import { itemBases } from "../data/itemBases";
import { createRng, type Rng } from "./rng";
import type {
  AffixDef,
  AffixTier,
  EquipmentSlotId,
  ItemBaseDef,
  ItemInstance,
  ItemRarity,
  ModifierDef,
  RolledAffix,
  StatBlock,
} from "./types";

const BALANCE_VERSION = "m1-loot-loop-v0";

export function getItemBaseDef(baseId: string): ItemBaseDef {
  const base = itemBases.find((entry) => entry.id === baseId);
  if (!base) {
    throw new Error(`Unknown item base: ${baseId}`);
  }
  return base;
}

export function getItemDisplayName(item: ItemInstance): string {
  const base = getItemBaseDef(item.baseId);
  if (item.affixes.length === 0) {
    return base.displayName;
  }

  if (item.rarity === "magic") {
    return `${item.affixes[0].displayName} ${base.displayName}`;
  }

  const prefix = item.affixes.find((affix) => affix.slot === "prefix")?.displayName ?? "Forged";
  const suffix = item.affixes.find((affix) => affix.slot === "suffix")?.displayName ?? "Relic";
  return `${prefix} ${base.displayName} of ${suffix}`;
}

export function getItemSlot(item: ItemInstance): EquipmentSlotId {
  return getItemBaseDef(item.baseId).equipmentSlot;
}

export function collectItemBaseStats(item: ItemInstance): StatBlock {
  return getItemBaseDef(item.baseId).baseStats;
}

export function collectItemModifiers(item: ItemInstance): ModifierDef[] {
  const base = getItemBaseDef(item.baseId);
  return [...base.implicitModifiers, ...item.affixes.flatMap((affix) => affix.modifiers)];
}

export function collectEquipmentBaseStats(equipment: Partial<Record<EquipmentSlotId, ItemInstance>>): StatBlock {
  const stats: StatBlock = {};

  for (const item of Object.values(equipment)) {
    if (!item) {
      continue;
    }

    for (const [stat, value] of Object.entries(collectItemBaseStats(item))) {
      stats[stat as keyof StatBlock] = (stats[stat as keyof StatBlock] ?? 0) + value;
    }
  }

  return stats;
}

export function collectEquipmentModifiers(equipment: Partial<Record<EquipmentSlotId, ItemInstance>>): ModifierDef[] {
  return Object.values(equipment).flatMap((item) => (item ? collectItemModifiers(item) : []));
}

export function getEligibleAffixes(base: ItemBaseDef, itemLevel: number, usedGroups = new Set<string>()): AffixDef[] {
  return affixes.filter(
    (affix) =>
      affix.minItemLevel <= itemLevel &&
      affix.itemClasses.includes(base.itemClass) &&
      !usedGroups.has(affix.group) &&
      affix.tiers.some((tier) => tier.itemLevel <= itemLevel),
  );
}

export function chooseRarity(rng: Rng, itemRarityBonus = 0): ItemRarity {
  const rarityScore = 1 + itemRarityBonus;
  const magicChance = Math.min(0.72, 0.26 * rarityScore ** 0.72);
  const rareChance = Math.min(0.34, 0.08 * rarityScore ** 0.72);
  const relicChance = Math.min(0.025, 0.003 * rarityScore ** 0.6);
  const roll = rng.next();

  if (roll < relicChance) {
    return "relic";
  }
  if (roll < relicChance + rareChance) {
    return "rare";
  }
  if (roll < relicChance + rareChance + magicChance) {
    return "magic";
  }
  return "normal";
}

export function affixCountForRarity(rarity: ItemRarity, rng: Rng): number {
  if (rarity === "normal") {
    return 0;
  }
  if (rarity === "magic") {
    return rng.int(1, 2);
  }
  if (rarity === "rare") {
    return rng.int(4, 6);
  }
  return 6;
}

function chooseTier(affix: AffixDef, itemLevel: number): { tier: AffixTier; tierIndex: number } {
  const eligible = affix.tiers
    .map((tier, index) => ({ tier, index }))
    .filter((entry) => entry.tier.itemLevel <= itemLevel)
    .sort((a, b) => b.tier.itemLevel - a.tier.itemLevel);

  if (eligible.length === 0) {
    throw new Error(`No eligible tier for affix ${affix.id}`);
  }

  return { tier: eligible[0].tier, tierIndex: eligible[0].index + 1 };
}

function rollTierValue(rng: Rng, tier: AffixTier): number {
  const value = tier.min + rng.next() * (tier.max - tier.min);
  return Math.round(value * 1000) / 1000;
}

function rollAffix(affix: AffixDef, itemLevel: number, rng: Rng): RolledAffix {
  const { tier, tierIndex } = chooseTier(affix, itemLevel);
  const rolledValue = rollTierValue(rng, tier);

  return {
    affixId: affix.id,
    displayName: affix.displayName,
    slot: affix.slot,
    group: affix.group,
    tier: tierIndex,
    modifiers: affix.modifiers.map((modifier) => ({
      ...modifier,
      id: `${modifier.id}_rolled`,
      value: rolledValue,
    })),
  };
}

export function generateItemForArea(
  areaId: string,
  seed: string,
  options: { rarity?: ItemRarity; baseId?: string; itemRarityBonus?: number } = {},
): ItemInstance {
  const area = getAreaDef(areaId);
  const rng = createRng(seed);
  const eligibleBases = itemBases.filter((base) => base.requiredLevel <= area.areaLevel);
  const base = options.baseId ? getItemBaseDef(options.baseId) : rng.pick(eligibleBases);
  const rarity = options.rarity ?? chooseRarity(rng, area.areaRarity + (options.itemRarityBonus ?? 0));
  const targetAffixCount = affixCountForRarity(rarity, rng);
  const usedGroups = new Set<string>();
  const rolledAffixes: RolledAffix[] = [];
  let prefixCount = 0;
  let suffixCount = 0;

  for (let index = 0; index < targetAffixCount; index += 1) {
    const candidates = getEligibleAffixes(base, area.areaLevel, usedGroups).filter((affix) => {
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

    const affix = rng.weighted(candidates, (candidate) => candidate.weight);
    const rolled = rollAffix(affix, area.areaLevel, rng);
    usedGroups.add(rolled.group);
    rolledAffixes.push(rolled);
    if (rolled.slot === "prefix") {
      prefixCount += 1;
    } else {
      suffixCount += 1;
    }
  }

  return {
    id: `item_${areaId}_${seed}`,
    baseId: base.id,
    rarity,
    itemLevel: area.areaLevel,
    affixes: rolledAffixes,
    generatedAt: new Date(0).toISOString(),
    generatedBy: {
      areaId,
      monsterLevel: area.areaLevel,
      balanceVersion: BALANCE_VERSION,
      seed,
    },
  };
}

export function generateLootSample(areaId: string, seed: string, count = 8): ItemInstance[] {
  return Array.from({ length: count }, (_, index) =>
    generateItemForArea(areaId, `${seed}_${index}`, {
      rarity: index === 0 ? "rare" : undefined,
    }),
  );
}

export function equipItem(buildEquipment: Partial<Record<EquipmentSlotId, ItemInstance>>, item: ItemInstance) {
  return {
    ...buildEquipment,
    [getItemSlot(item)]: item,
  };
}
