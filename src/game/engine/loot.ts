import { getAreaDef } from "../data/areas";
import { getBuildModifiers, getCharacterBaseStats } from "./character";
import { resolveStat } from "./modifiers";
import type { CharacterBuild, CombatSummary, DefenseSummary, LootSummary } from "./types";

export function resolveLoot(
  build: CharacterBuild,
  areaId: string,
  combat: CombatSummary,
  defense: DefenseSummary,
): LootSummary {
  const area = getAreaDef(areaId);
  const baseStats = getCharacterBaseStats(build);
  const modifiers = getBuildModifiers(build);
  const farmEfficiency = Math.max(0, 1 - defense.deathsPerHour * 0.02);
  const combatKillsPerMinute = Math.min(area.maxKillsPerMinute, (combat.dps / area.monsterLife) * 60);
  const killsPerHour = combatKillsPerMinute * 60 * farmEfficiency;
  const itemQuantity = resolveStat(baseStats.itemQuantity ?? 0, modifiers, "itemQuantity");
  const itemRarity = resolveStat(baseStats.itemRarity ?? 0, modifiers, "itemRarity");
  const rawItemsPerHour = killsPerHour * area.baseDropChance * area.rewardMultiplier;
  const itemsPerHour = rawItemsPerHour * (1 + itemQuantity + area.areaQuantity);
  const rarityScore = 1 + itemRarity + area.areaRarity;
  const magicChance = Math.min(0.75, 0.2 * rarityScore ** 0.75);
  const rareChance = Math.min(0.45, 0.06 * rarityScore ** 0.75);
  const chaseChance = Math.min(0.05, 0.004 * rarityScore ** 0.65);
  const commonChance = Math.max(0, 1 - magicChance - rareChance - chaseChance);
  const commonItems = itemsPerHour * commonChance;
  const magicItems = itemsPerHour * magicChance;
  const rareItemsPerHour = itemsPerHour * rareChance;
  const chaseItemsPerHour = itemsPerHour * chaseChance;
  const currencyPerHour = 24 * (1 + itemQuantity + area.areaQuantity) * area.rewardMultiplier;
  const totalEvPerHour =
    commonItems * 1 +
    magicItems * 3 +
    rareItemsPerHour * 18 +
    chaseItemsPerHour * 250 +
    currencyPerHour +
    (commonItems + magicItems) * 0.6;

  return {
    farmEfficiency,
    killsPerHour,
    itemsPerHour,
    rareItemsPerHour,
    chaseItemsPerHour,
    currencyPerHour,
    totalEvPerHour,
  };
}
