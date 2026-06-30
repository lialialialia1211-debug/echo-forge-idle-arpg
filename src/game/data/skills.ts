import type { SkillDef } from "../engine/types";

export const skills: SkillDef[] = [
  {
    id: "skill_shard_volley",
    displayName: "Shard Volley",
    tags: ["attack", "projectile", "physical", "critical"],
    damageTypes: ["physical"],
    baseUseTime: 0.72,
    baseCritChance: 0.07,
    baseDamageByLevel: { base: 118, perLevel: 17, growth: 1.018 },
    allowedClassIds: ["veilrunner"],
  },
  {
    id: "skill_ember_lance",
    displayName: "Ember Lance",
    tags: ["spell", "projectile", "fire"],
    damageTypes: ["fire"],
    baseUseTime: 0.84,
    baseCritChance: 0.06,
    baseDamageByLevel: { base: 132, perLevel: 20, growth: 1.02 },
    allowedClassIds: ["ashweaver"],
  },
  {
    id: "skill_granite_cleave",
    displayName: "Granite Cleave",
    tags: ["attack", "melee", "physical", "area"],
    damageTypes: ["physical"],
    baseUseTime: 0.96,
    baseCritChance: 0.045,
    baseDamageByLevel: { base: 172, perLevel: 25, growth: 1.016 },
    allowedClassIds: ["ironbound"],
  },
  {
    id: "skill_storm_skein",
    displayName: "Storm Skein",
    tags: ["spell", "lightning", "area", "critical"],
    damageTypes: ["lightning"],
    baseUseTime: 0.88,
    baseCritChance: 0.075,
    baseDamageByLevel: { base: 112, perLevel: 23, growth: 1.022 },
  },
  {
    id: "skill_bone_satellite",
    displayName: "Bone Satellite",
    tags: ["spell", "minion", "void", "duration"],
    damageTypes: ["void"],
    baseUseTime: 1.12,
    baseCritChance: 0.04,
    baseDamageByLevel: { base: 94, perLevel: 22, growth: 1.024 },
  },
  {
    id: "skill_rift_sunder",
    displayName: "Rift Sunder",
    tags: ["attack", "melee", "area", "void"],
    damageTypes: ["void", "physical"],
    baseUseTime: 1.08,
    baseCritChance: 0.05,
    baseDamageByLevel: { base: 188, perLevel: 27, growth: 1.017 },
  },
];

export function getSkillDef(skillId: string): SkillDef {
  const skill = skills.find((entry) => entry.id === skillId);
  if (!skill) {
    throw new Error(`Unknown skill: ${skillId}`);
  }
  return skill;
}
