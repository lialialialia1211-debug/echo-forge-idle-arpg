import { getClassDef } from "../data/classes";
import { getSkillDef } from "../data/skills";
import { isSupportCompatible, supports } from "../data/supports";
import type { CharacterBuild } from "./types";

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
