import { topEngravings, getTopEngravingDef } from "../data/engravings";
import { getTopPartBaseDef, topPartBases } from "../data/topPartBases";
import { createRng, type Rng } from "./rng";
import type {
  ArenaDrop,
  TopEngravingDef,
  TopPartBaseDef,
  TopPartGeneratedBy,
  TopPartInstance,
  TopPartRarity,
  TopPartSlotId,
  TopResistanceBlock,
  TopRolledEngraving,
  TopStatBlock,
} from "./topTypes";

export const TOP_PART_BALANCE_VERSION = "top-parts-v1";

type GenerateTopPartOptions = {
  id?: string;
  baseId?: string;
  slot?: TopPartSlotId;
  rarity?: TopPartRarity;
  itemLevel: number;
  seed: string;
  arenaId: string;
  enemyLevel: number;
  source: TopPartGeneratedBy["source"];
  sourceDropId?: string;
  locked?: boolean;
  affixIds?: string[];
  exactAffixIds?: boolean;
};

const rarityNames: Record<TopPartRarity, string> = {
  common: "",
  tuned: "Tuned",
  engraved: "Engraved",
  relic: "Relic",
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

function scaleStats(stats: TopStatBlock = {}, scalar: number): TopStatBlock {
  const next: TopStatBlock = {};
  for (const [stat, value] of Object.entries(stats)) {
    next[stat as keyof TopStatBlock] = Math.round((value ?? 0) * scalar * 1000) / 1000;
  }
  return next;
}

function cloneModifiers(modifiers = [] as TopEngravingDef["modifiers"], suffix: string, scalar?: number) {
  return (modifiers ?? []).map((modifier) => ({
    ...modifier,
    id: `${modifier.id}_${suffix}`,
    value: scalar === undefined || modifier.value !== 1 ? modifier.value : Math.round(scalar * 1000) / 1000,
  }));
}

function chooseTier(engraving: TopEngravingDef, itemLevel: number) {
  const eligible = (engraving.tiers ?? [])
    .map((tier, index) => ({ tier, index }))
    .filter((entry) => entry.tier.itemLevel <= itemLevel)
    .sort((a, b) => b.tier.itemLevel - a.tier.itemLevel);

  if (eligible.length === 0) {
    return null;
  }

  return { tier: eligible[0].tier, tierIndex: eligible[0].index + 1 };
}

function rollTierValue(rng: Rng, engraving: TopEngravingDef, itemLevel: number): { value: number; tier: number } {
  const tier = chooseTier(engraving, itemLevel);
  if (!tier) {
    return { value: 1, tier: 0 };
  }

  const value = tier.tier.min + rng.next() * (tier.tier.max - tier.tier.min);
  return { value: Math.round(value * 1000) / 1000, tier: tier.tierIndex };
}

export function rollTopEngraving(engraving: TopEngravingDef, itemLevel: number, rng: Rng, suffix: string): TopRolledEngraving {
  const tierRoll = rollTierValue(rng, engraving, itemLevel);

  return {
    engravingId: engraving.id,
    displayName: engraving.displayName,
    slot: engraving.slot,
    group: engraving.group,
    tier: tierRoll.tier,
    statBonuses: engraving.tiers ? scaleStats(engraving.statBonuses, tierRoll.value) : (engraving.statBonuses ?? {}),
    resistanceBonuses: engraving.resistanceBonuses ?? {},
    modifiers: cloneModifiers(engraving.modifiers, suffix, engraving.tiers ? tierRoll.value : undefined),
  };
}

export function chooseTopPartRarity(rng: Rng, rarityBonus = 0): TopPartRarity {
  const rarityScore = 1 + rarityBonus;
  const tunedChance = Math.min(0.72, 0.32 * rarityScore ** 0.72);
  const engravedChance = Math.min(0.34, 0.09 * rarityScore ** 0.72);
  const relicChance = Math.min(0.025, 0.004 * rarityScore ** 0.62);
  const roll = rng.next();

  if (roll < relicChance) {
    return "relic";
  }
  if (roll < relicChance + engravedChance) {
    return "engraved";
  }
  if (roll < relicChance + engravedChance + tunedChance) {
    return "tuned";
  }
  return "common";
}

export function topPartAffixSlotsForRarity(rarity: TopPartRarity): Record<"prefix" | "suffix", number> {
  if (rarity === "common" || rarity === "relic") {
    return { prefix: 0, suffix: 0 };
  }
  if (rarity === "tuned") {
    return { prefix: 1, suffix: 1 };
  }
  return { prefix: 3, suffix: 3 };
}

export function topPartAffixCountForRarity(rarity: TopPartRarity): number {
  const slots = topPartAffixSlotsForRarity(rarity);
  return slots.prefix + slots.suffix;
}

export function getEligibleTopEngravings(base: TopPartBaseDef, itemLevel: number, usedGroups = new Set<string>()): TopEngravingDef[] {
  return topEngravings.filter(
    (engraving) =>
      engraving.minItemLevel <= itemLevel &&
      (!engraving.slots || engraving.slots.includes(base.slot)) &&
      !usedGroups.has(engraving.group) &&
      (!engraving.tiers || engraving.tiers.some((tier) => tier.itemLevel <= itemLevel)),
  );
}

function chooseBase(rng: Rng, options: Pick<GenerateTopPartOptions, "baseId" | "slot" | "itemLevel" | "rarity">): TopPartBaseDef {
  if (options.baseId) {
    return getTopPartBaseDef(options.baseId);
  }

  const candidates = topPartBases.filter((base) => (!options.slot || base.slot === options.slot) && (base.requiredLevel ?? 1) <= options.itemLevel);
  return rng.weighted(candidates, (base) => (base.uniqueEffect && options.rarity !== "relic" ? 0 : (base.baseWeight ?? 100)));
}

function rollEngravings({
  base,
  rarity,
  itemLevel,
  rng,
  seed,
  forcedAffixIds,
  exactAffixIds,
}: {
  base: TopPartBaseDef;
  rarity: TopPartRarity;
  itemLevel: number;
  rng: Rng;
  seed: string;
  forcedAffixIds?: string[];
  exactAffixIds?: boolean;
}): TopRolledEngraving[] {
  const usedGroups = new Set<string>();
  const rolled: TopRolledEngraving[] = [];
  let prefixCount = 0;
  let suffixCount = 0;
  const slotLimits = exactAffixIds ? { prefix: 3, suffix: 3 } : topPartAffixSlotsForRarity(rarity);

  const tryAdd = (engraving: TopEngravingDef) => {
    if (usedGroups.has(engraving.group)) {
      return false;
    }
    if (engraving.slot === "prefix" && prefixCount >= slotLimits.prefix) {
      return false;
    }
    if (engraving.slot === "suffix" && suffixCount >= slotLimits.suffix) {
      return false;
    }
    if (engraving.slots && !engraving.slots.includes(base.slot)) {
      return false;
    }
    if (engraving.minItemLevel > itemLevel) {
      return false;
    }

    const suffix = `${seed}_${rolled.length}`;
    const rolledEngraving = rollTopEngraving(engraving, itemLevel, rng, suffix);
    rolled.push(rolledEngraving);
    usedGroups.add(rolledEngraving.group);
    if (rolledEngraving.slot === "prefix") {
      prefixCount += 1;
    } else {
      suffixCount += 1;
    }
    return true;
  };

  for (const affixId of forcedAffixIds ?? []) {
    tryAdd(getTopEngravingDef(affixId));
  }

  const targetCount = exactAffixIds ? rolled.length : Math.max(rolled.length, topPartAffixCountForRarity(rarity));
  while (rolled.length < targetCount) {
    const candidates = getEligibleTopEngravings(base, itemLevel, usedGroups).filter((engraving) => {
      if (engraving.slot === "prefix" && prefixCount >= slotLimits.prefix) {
        return false;
      }
      if (engraving.slot === "suffix" && suffixCount >= slotLimits.suffix) {
        return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      break;
    }

    tryAdd(rng.weighted(candidates, (engraving) => engraving.weight));
  }

  return rolled;
}

export function assembleTopPartFromAffixes({
  id,
  base,
  rarity,
  itemLevel,
  affixes,
  generatedBy,
  locked,
  sourceDropId,
}: {
  id: string;
  base: TopPartBaseDef;
  rarity: TopPartRarity;
  itemLevel: number;
  affixes: TopRolledEngraving[];
  generatedBy: TopPartGeneratedBy;
  locked?: boolean;
  sourceDropId?: string;
}): TopPartInstance {
  const prefix = base.uniqueEffect ? "Unique" : rarityNames[rarity];
  const affixName = affixes[0]?.displayName;
  const displayName = [prefix, affixName, base.displayName].filter(Boolean).join(" ");
  let statBonuses = base.implicitStats ?? {};
  let resistanceBonuses = base.implicitResistances ?? {};
  let modifiers = cloneModifiers(base.implicitModifiers, id);

  for (const affix of affixes) {
    statBonuses = addStats(statBonuses, affix.statBonuses);
    resistanceBonuses = addResistances(resistanceBonuses, affix.resistanceBonuses);
    modifiers = [...modifiers, ...affix.modifiers];
  }

  return {
    id,
    baseId: base.id,
    displayName,
    slot: base.slot,
    rarity,
    itemLevel,
    affixes,
    statBonuses,
    resistanceBonuses,
    modifiers,
    locked,
    sourceDropId,
    generatedAt: new Date(0).toISOString(),
    generatedBy,
  };
}

export function generateTopPart(options: GenerateTopPartOptions): TopPartInstance {
  const rng = createRng(options.seed);
  const rarity = options.rarity ?? chooseTopPartRarity(rng);
  const base = chooseBase(rng, { ...options, rarity });
  const id = options.id ?? `part_${options.arenaId}_${options.seed}`;
  const generatedBy: TopPartGeneratedBy = {
    arenaId: options.arenaId,
    enemyLevel: options.enemyLevel,
    balanceVersion: TOP_PART_BALANCE_VERSION,
    seed: options.seed,
    source: options.source,
  };
  const affixes = rollEngravings({
    base,
    rarity,
    itemLevel: options.itemLevel,
    rng,
    seed: options.seed,
    forcedAffixIds: options.affixIds,
    exactAffixIds: options.exactAffixIds,
  });

  return assembleTopPartFromAffixes({
    id,
    base,
    rarity,
    itemLevel: options.itemLevel,
    affixes,
    generatedBy,
    locked: options.locked,
    sourceDropId: options.sourceDropId,
  });
}

function baseSlotForDropLabel(label: string): TopPartSlotId | undefined {
  if (label.includes("Attack Ring")) {
    return "attackRing";
  }
  if (label.includes("Weight Disk")) {
    return "weightDisk";
  }
  if (label.includes("Needle Tip")) {
    return "tip";
  }
  if (label.includes("Core")) {
    return "core";
  }
  if (label.includes("Seal")) {
    return "seal";
  }
  if (label.includes("Launcher")) {
    return "launcher";
  }
  if (label.includes("Circuit Chip")) {
    return "circuitChip";
  }
  return undefined;
}

export function createPartFromArenaDrop(drop: ArenaDrop, arenaTier: number, wave: number): TopPartInstance {
  const itemLevel = Math.max(1, arenaTier * 3 + wave);
  return generateTopPart({
    id: `part_${drop.id}`,
    baseId: drop.baseId,
    slot: drop.slot ?? baseSlotForDropLabel(drop.label),
    rarity: drop.rarity,
    itemLevel,
    seed: `${drop.id}_${drop.label}_${drop.rarity}_${arenaTier}_${wave}`,
    arenaId: `arena_tier_${arenaTier}`,
    enemyLevel: itemLevel,
    source: "drop",
    sourceDropId: drop.id,
  });
}
