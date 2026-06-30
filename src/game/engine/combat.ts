import { getAreaDef } from "../data/areas";
import { getSkillDef } from "../data/skills";
import { getBuildModifiers, getCharacterBaseStats } from "./character";
import { clamp } from "./math";
import { hitChanceFromRatings, levelCurveValue, resolveStat, sumSpecialModifiers } from "./modifiers";
import type { CharacterBuild, CombatSummary } from "./types";

export function resolveCombat(build: CharacterBuild, areaId: string): CombatSummary {
  const area = getAreaDef(areaId);
  const skill = getSkillDef(build.skillId);
  const baseStats = getCharacterBaseStats(build);
  const modifiers = getBuildModifiers(build);
  const tags = skill.tags;

  const skillBaseDamage = levelCurveValue(skill.baseDamageByLevel, build.level);
  const flatDamage = resolveStat(baseStats.flatDamage ?? 0, modifiers, "flatDamage", tags);
  const scaledDamage = resolveStat(skillBaseDamage + flatDamage, modifiers, "damage", tags);
  const extraAsDamage = sumSpecialModifiers(modifiers, "extraAsDamage", "extraAs", tags);
  const penetration = sumSpecialModifiers(modifiers, "penetration", "penetration", tags);
  const effectiveResistance = clamp(area.enemyResistance - penetration, -1, 0.75);
  const accuracy = resolveStat(baseStats.accuracy ?? 1000, modifiers, "accuracy", tags);
  const hitChance = hitChanceFromRatings(accuracy, area.enemyEvasion);
  const critChance = clamp(resolveStat(skill.baseCritChance, modifiers, "critChance", tags), 0, 1);
  const critMultiplier = Math.max(1, resolveStat(baseStats.critMultiplier ?? 1.5, modifiers, "critMultiplier", tags));
  const critExpectedMultiplier = 1 + critChance * (critMultiplier - 1);
  const actionSpeed = resolveStat(1, modifiers, "actionSpeed", tags);
  const hitsPerSecond = (1 / skill.baseUseTime) * actionSpeed;
  const uptime = 0.92;

  const averageHit =
    scaledDamage *
    (1 + extraAsDamage) *
    (1 - effectiveResistance) *
    hitChance *
    critExpectedMultiplier;

  const dps = averageHit * hitsPerSecond * uptime;

  return {
    averageHit,
    dps,
    hitChance,
    critChance,
    critExpectedMultiplier,
    effectiveResistance,
    hitsPerSecond,
    bossTimeToKill: area.bossLife / Math.max(1, dps),
  };
}
