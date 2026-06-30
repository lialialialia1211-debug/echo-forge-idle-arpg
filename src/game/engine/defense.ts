import { getAreaDef } from "../data/areas";
import { getBuildModifiers, getCharacterBaseStats } from "./character";
import { clamp } from "./math";
import { hitChanceFromRatings, resolveStat } from "./modifiers";
import type { CharacterBuild, DefenseSummary } from "./types";

export function resolveDefense(build: CharacterBuild, areaId: string): DefenseSummary {
  const area = getAreaDef(areaId);
  const baseStats = getCharacterBaseStats(build);
  const modifiers = getBuildModifiers(build);
  const life = resolveStat(baseStats.life ?? 1, modifiers, "life");
  const shield = resolveStat(baseStats.shield ?? 0, modifiers, "shield");
  const armour = resolveStat(baseStats.armour ?? 0, modifiers, "armour");
  const evasion = resolveStat(baseStats.evasion ?? 0, modifiers, "evasion");
  const blockChance = clamp(resolveStat(baseStats.blockChance ?? 0, modifiers, "blockChance"), 0, 0.75);
  const resistance = clamp(resolveStat(baseStats.resistance ?? 0.12, modifiers, "resistance"), -1, 0.75);
  const recoveryPerSecond = resolveStat(baseStats.recoveryPerSecond ?? 0, modifiers, "recoveryPerSecond");
  const pool = life + shield;
  const representativePhysicalHit = area.monsterDamage * 0.74;
  const representativeElementalHit = area.monsterDamage * 0.54;
  const armourReduction = clamp(
    armour / Math.max(1, armour + 5 * representativePhysicalHit),
    0,
    0.9,
  );
  const enemyHitChance = hitChanceFromRatings(area.enemyAccuracy, evasion);
  const evadeChance = 1 - enemyHitChance;
  const blockPrevention = blockChance;

  const physicalTaken =
    representativePhysicalHit * (1 - armourReduction) * (1 - evadeChance) * (1 - blockPrevention);
  const elementalTaken =
    representativeElementalHit * (1 - resistance) * (1 - evadeChance) * (1 - blockPrevention);
  const physicalEhp = pool / Math.max(0.01, physicalTaken / representativePhysicalHit);
  const elementalEhp = pool / Math.max(0.01, elementalTaken / representativeElementalHit);
  const expectedIncomingDps = (physicalTaken + elementalTaken) * 1.2;
  const netDamagePerSecond = Math.max(0, expectedIncomingDps - recoveryPerSecond);
  const deathsPerHour = netDamagePerSecond === 0 ? 0 : (netDamagePerSecond / Math.max(1, pool)) * 60;

  return {
    pool,
    physicalEhp,
    elementalEhp,
    armourReduction,
    evadeChance,
    expectedIncomingDps,
    netDamagePerSecond,
    deathsPerHour,
  };
}
