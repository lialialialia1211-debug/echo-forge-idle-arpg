import { getClassDef } from "../data/classes";
import { getSkillDef } from "../data/skills";
import { isSupportCompatible, supports } from "../data/supports";
import { collectEquipmentBaseStats, collectEquipmentModifiers } from "./items";
import { mergeStatBlocks } from "./modifiers";
import type { CharacterBuild, ModifierDef, StatBlock, StatId } from "./types";

export function getCharacterBaseStats(build: CharacterBuild): StatBlock {
  const classDef = getClassDef(build.classId);
  const growthEntries = Object.entries(classDef.growth) as [StatId, number][];
  const growthStats = growthEntries.reduce<StatBlock>((acc, [stat, value]) => {
    acc[stat] = value * Math.max(0, build.level - 1);
    return acc;
  }, {});

  return mergeStatBlocks(classDef.baseStats, growthStats, collectEquipmentBaseStats(build.equipment));
}

export function getSkillSupportModifiers(build: CharacterBuild): ModifierDef[] {
  const skill = getSkillDef(build.skillId);
  return build.supportIds
    .map((supportId) => supports.find((support) => support.id === supportId))
    .filter((support): support is NonNullable<typeof support> => Boolean(support))
    .filter((support) => isSupportCompatible(support, skill.tags))
    .flatMap((support) => support.modifiers);
}

export function createStarterBuild(classId: string): CharacterBuild {
  const classDef = getClassDef(classId);
  const skill = getSkillDef(classDef.startingSkills[0]);
  const compatibleSupports = supports
    .filter((support) => isSupportCompatible(support, skill.tags))
    .slice(0, 3)
    .map((support) => support.id);

  return {
    id: `char_${classId}_prototype`,
    name: classDef.displayName,
    classId,
    level: 8,
    skillId: skill.id,
    supportIds: compatibleSupports,
    equipment: {},
    modifiers: [
      { id: "prototype_training_damage", stat: "damage", type: "increased", value: 0.35, source: "passive" },
      { id: "prototype_training_resistance", stat: "resistance", type: "flat", value: 0.22, source: "passive" },
    ],
  };
}

export function getBuildModifiers(build: CharacterBuild): ModifierDef[] {
  return [...build.modifiers, ...getSkillSupportModifiers(build), ...collectEquipmentModifiers(build.equipment)];
}
