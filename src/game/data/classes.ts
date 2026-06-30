import type { ClassDef } from "../engine/types";

export const classes: ClassDef[] = [
  {
    id: "veilrunner",
    displayName: "Veilrunner",
    role: "Projectile crit skirmisher",
    fantasy: "Speed, evasion, precision, and chain kills.",
    primaryAttributes: ["dexterity"],
    baseStats: {
      dexterity: 26,
      strength: 12,
      intelligence: 12,
      life: 1180,
      shield: 120,
      armour: 450,
      evasion: 980,
      accuracy: 1450,
      recoveryPerSecond: 70,
      critMultiplier: 1.65,
      itemQuantity: 0.08,
    },
    growth: {
      life: 64,
      evasion: 62,
      accuracy: 52,
      recoveryPerSecond: 4,
    },
    startingSkills: ["skill_shard_volley"],
    preferredTags: ["attack", "projectile", "critical", "physical"],
    passiveStartNode: "start_veilrunner",
  },
  {
    id: "ashweaver",
    displayName: "Ashweaver",
    role: "Elemental spell channeler",
    fantasy: "Fire, lightning, shield pressure, and volatile burst windows.",
    primaryAttributes: ["intelligence"],
    baseStats: {
      intelligence: 28,
      dexterity: 10,
      strength: 10,
      life: 960,
      shield: 540,
      armour: 260,
      evasion: 380,
      accuracy: 900,
      recoveryPerSecond: 82,
      critMultiplier: 1.55,
      itemRarity: 0.12,
    },
    growth: {
      life: 48,
      shield: 46,
      recoveryPerSecond: 5,
      damage: 0.018,
    },
    startingSkills: ["skill_ember_lance"],
    preferredTags: ["spell", "fire", "lightning", "projectile"],
    passiveStartNode: "start_ashweaver",
  },
  {
    id: "ironbound",
    displayName: "Ironbound",
    role: "Armour melee bruiser",
    fantasy: "Huge hits, stubborn armour, block, and recovery.",
    primaryAttributes: ["strength"],
    baseStats: {
      strength: 30,
      dexterity: 8,
      intelligence: 8,
      life: 1520,
      shield: 60,
      armour: 1450,
      evasion: 210,
      accuracy: 1100,
      blockChance: 0.12,
      recoveryPerSecond: 105,
      critMultiplier: 1.5,
    },
    growth: {
      life: 86,
      armour: 94,
      accuracy: 38,
      recoveryPerSecond: 6,
    },
    startingSkills: ["skill_granite_cleave"],
    preferredTags: ["attack", "melee", "physical", "area"],
    passiveStartNode: "start_ironbound",
  },
];

export function getClassDef(classId: string): ClassDef {
  const classDef = classes.find((entry) => entry.id === classId);
  if (!classDef) {
    throw new Error(`Unknown class: ${classId}`);
  }
  return classDef;
}
