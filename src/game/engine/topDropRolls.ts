import { getArenaCircuitDef } from "../data/arenaCircuits";
import { createRng, type Rng } from "./rng";
import { clamp } from "./math";
import type { ArenaDrop, ArenaRewardBias, TopPartSlotId } from "./topTypes";

type DropLabelOption = { label: string; target: TopPartSlotId; weight: number };

const dropLabelOptions: DropLabelOption[] = [
  { label: "Ash Core", target: "core", weight: 1 },
  { label: "Static Core", target: "core", weight: 0.86 },
  { label: "Void Core", target: "core", weight: 0.42 },
  { label: "Attack Ring", target: "attackRing", weight: 1 },
  { label: "Razor Ring", target: "attackRing", weight: 0.82 },
  { label: "Furnace Ring", target: "attackRing", weight: 0.7 },
  { label: "Weight Disk", target: "weightDisk", weight: 1 },
  { label: "Orbit Disk", target: "weightDisk", weight: 0.76 },
  { label: "Judicator Disk", target: "weightDisk", weight: 0.46 },
  { label: "Needle Tip", target: "tip", weight: 1 },
  { label: "Anchor Tip", target: "tip", weight: 0.78 },
  { label: "Molten Tip", target: "tip", weight: 0.68 },
  { label: "Launcher", target: "launcher", weight: 1 },
  { label: "Tempest Launcher", target: "launcher", weight: 0.7 },
  { label: "Storm Seal", target: "seal", weight: 0.92 },
  { label: "Ember Seal", target: "seal", weight: 0.72 },
  { label: "Null Seal", target: "seal", weight: 0.46 },
  { label: "Circuit Chip", target: "circuitChip", weight: 1 },
  { label: "Mapwright Chip", target: "circuitChip", weight: 0.74 },
  { label: "Omen Chip", target: "circuitChip", weight: 0.56 },
];

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
  x = 0,
  y = 0,
}: RollDropOutcomeInput): ArenaDrop | null {
  const arena = getArenaCircuitDef(arenaId);
  const rng = createRng(seed);
  const dropChance = clamp(0.26 * arena.rewardMultiplier * (1 + rewardQuantity) * (1 + playerPartQuantity), 0.08, 0.95);

  if (rng.next() > dropChance) {
    return null;
  }

  const rarityRoll = rng.next() * (1 + playerPartRarity + arena.tier * 0.05 + rewardRarity);
  const rarity: ArenaDrop["rarity"] = rarityRoll > 0.98 ? "relic" : rarityRoll > 0.62 ? "engraved" : rarityRoll > 0.28 ? "tuned" : "common";
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
