import { getArenaCircuitDef } from "../data/arenaCircuits";
import { balanceConfig } from "../data/balanceConfig";
import { createRng, type Rng } from "./rng";
import { clamp } from "./math";
import type { ArenaDrop, ArenaDropPityState, ArenaRewardBias, TopPartSlotId } from "./topTypes";

type DropLabelOption = { label: string; target: TopPartSlotId; weight: number };
type DropRarityWeights = Record<ArenaDrop["rarity"], number>;

export const dropLabelOptions: DropLabelOption[] = [
  { label: "Ash Core", target: "core", weight: 0.88 },
  { label: "Static Core", target: "core", weight: 0.75 },
  { label: "Void Core", target: "core", weight: 0.37 },
  { label: "Attack Ring", target: "attackRing", weight: 0.79 },
  { label: "Razor Ring", target: "attackRing", weight: 0.65 },
  { label: "Furnace Ring", target: "attackRing", weight: 0.56 },
  { label: "Weight Disk", target: "weightDisk", weight: 0.9 },
  { label: "Orbit Disk", target: "weightDisk", weight: 0.68 },
  { label: "Judicator Disk", target: "weightDisk", weight: 0.41 },
  { label: "Needle Tip", target: "tip", weight: 0.81 },
  { label: "Anchor Tip", target: "tip", weight: 0.63 },
  { label: "Molten Tip", target: "tip", weight: 0.55 },
  { label: "Launcher", target: "launcher", weight: 1.18 },
  { label: "Tempest Launcher", target: "launcher", weight: 0.82 },
  { label: "Storm Seal", target: "seal", weight: 0.88 },
  { label: "Ember Seal", target: "seal", weight: 0.69 },
  { label: "Null Seal", target: "seal", weight: 0.44 },
  { label: "Circuit Chip", target: "circuitChip", weight: 0.87 },
  { label: "Mapwright Chip", target: "circuitChip", weight: 0.64 },
  { label: "Omen Chip", target: "circuitChip", weight: 0.49 },
];

const rarityOrder: ArenaDrop["rarity"][] = ["common", "tuned", "engraved", "relic"];
const rarityRank: Record<ArenaDrop["rarity"], number> = {
  common: 0,
  tuned: 1,
  engraved: 2,
  relic: 3,
};

export const initialDropPityState: ArenaDropPityState = {
  killsSinceTuned: 0,
  killsSinceEngraved: 0,
};

export type RollDropOutcomeInput = {
  arenaId: string;
  seed: string;
  wave: number;
  killCount: number;
  playerPartQuantity: number;
  playerPartRarity: number;
  rewardQuantity?: number;
  rewardRarity?: number;
  rewardBias?: ArenaRewardBias[];
  pity?: ArenaDropPityState;
  x?: number;
  y?: number;
};

function biasWeight(target: TopPartSlotId, biases: ArenaRewardBias[]): number {
  return biases.reduce((weight, bias) => {
    if (bias.target === target || bias.target === "any") {
      return weight + bias.weight;
    }
    return weight;
  }, 1);
}

function chooseDropOption(rng: Rng, biases: ArenaRewardBias[] = []): DropLabelOption {
  return rng.weighted(dropLabelOptions, (option) => option.weight * biasWeight(option.target, biases));
}

function clampTier(tier: number): keyof typeof balanceConfig.drops.rarityWeightsByTier {
  return Math.max(1, Math.min(5, Math.floor(tier))) as keyof typeof balanceConfig.drops.rarityWeightsByTier;
}

export function dropRarityWeightsForTier(tier: number, rarityScore = 0): DropRarityWeights {
  const base = balanceConfig.drops.rarityWeightsByTier[clampTier(tier)];
  const rareScale = (1 + Math.max(0, rarityScore)) ** balanceConfig.drops.rarityExponent;
  return {
    common: base.common,
    tuned: base.tuned,
    engraved: base.engraved * rareScale,
    relic: base.relic * rareScale,
  };
}

export function dropRarityChancesForTier(tier: number, rarityScore = 0): DropRarityWeights {
  const weights = dropRarityWeightsForTier(tier, rarityScore);
  const total = rarityOrder.reduce((sum, rarity) => sum + weights[rarity], 0);
  return {
    common: weights.common / total,
    tuned: weights.tuned / total,
    engraved: weights.engraved / total,
    relic: weights.relic / total,
  };
}

export function dropChanceForArena(arenaId: string, playerPartQuantity: number, rewardQuantity = 0): number {
  const arena = getArenaCircuitDef(arenaId);
  return clamp(0.26 * arena.rewardMultiplier * (1 + rewardQuantity) * (1 + playerPartQuantity), 0.08, 0.95);
}

function chooseDropRarity(rng: Rng, tier: number, rarityScore: number, pity?: ArenaDropPityState): ArenaDrop["rarity"] {
  const rarity = rng.weighted(rarityOrder, (entry) => dropRarityWeightsForTier(tier, rarityScore)[entry]);
  const minimumRarity = minimumRarityFromPity(pity);
  if (!minimumRarity || rarityRank[rarity] >= rarityRank[minimumRarity]) {
    return rarity;
  }
  return minimumRarity;
}

export function minimumRarityFromPity(pity?: ArenaDropPityState): ArenaDrop["rarity"] | null {
  if (!pity) {
    return null;
  }
  if (pity.killsSinceEngraved >= balanceConfig.drops.pity.engravedAfterKills) {
    return "engraved";
  }
  if (pity.killsSinceTuned >= balanceConfig.drops.pity.tunedAfterKills) {
    return "tuned";
  }
  return null;
}

export function advanceDropPity(pity: ArenaDropPityState, rarity: ArenaDrop["rarity"] | null): ArenaDropPityState {
  if (rarity === "engraved" || rarity === "relic") {
    return { killsSinceTuned: 0, killsSinceEngraved: 0 };
  }
  if (rarity === "tuned") {
    return { killsSinceTuned: 0, killsSinceEngraved: pity.killsSinceEngraved + 1 };
  }
  return {
    killsSinceTuned: pity.killsSinceTuned + 1,
    killsSinceEngraved: pity.killsSinceEngraved + 1,
  };
}

export function rollDropOutcome({
  arenaId,
  seed,
  wave,
  killCount,
  playerPartQuantity,
  playerPartRarity,
  rewardQuantity = 0,
  rewardRarity = 0,
  rewardBias = [],
  pity,
  x = 0,
  y = 0,
}: RollDropOutcomeInput): ArenaDrop | null {
  const rng = createRng(seed);
  const arena = getArenaCircuitDef(arenaId);
  const dropChance = dropChanceForArena(arenaId, playerPartQuantity, rewardQuantity);

  if (rng.next() > dropChance) {
    return null;
  }

  const rarityScore = playerPartRarity + rewardRarity;
  const rarity = chooseDropRarity(rng, arena.tier, rarityScore, pity);
  const dropOption = chooseDropOption(rng, rewardBias);

  return {
    id: `drop_${wave}_${killCount}`,
    label: dropOption.label,
    slot: dropOption.target,
    rarity,
    x,
    y,
    age: 0,
  };
}
