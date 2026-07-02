import { z } from "zod";
import { createStarterBuild } from "../engine/character";
import { createStarterEquipment, createStarterInventory } from "../data/topParts";

const nonNegativeIntegerSchema = z.preprocess(
  (value) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : value),
  z.number().int().min(0).default(0),
);

export const characterSaveSchema = z.object({
  id: z.string(),
  name: z.string(),
  classId: z.string(),
  level: z.number().int().min(1),
  xp: z.number().min(0),
  selectedAreaId: z.string(),
  build: z.object({
    skillId: z.string(),
    supportIds: z.array(z.string()).max(5),
  }),
  lastSettledAt: z.string(),
});

const topModifierSchema = z.object({
  id: z.string(),
  stat: z.string(),
  type: z.string(),
  value: z.number(),
  tags: z.array(z.string()).optional(),
  fromDamageType: z.string().optional(),
  toDamageType: z.string().optional(),
  scope: z.enum(["local", "global"]).optional(),
  condition: z.unknown().optional(),
});

const topRolledEngravingSchema = z.object({
  engravingId: z.string(),
  displayName: z.string(),
  slot: z.enum(["prefix", "suffix"]),
  group: z.string(),
  tier: z.number(),
  statBonuses: z.record(z.string(), z.number()),
  resistanceBonuses: z.record(z.string(), z.number()),
  modifiers: z.array(topModifierSchema),
});

export const topPartSaveSchema = z.object({
  id: z.string(),
  baseId: z.string(),
  displayName: z.string(),
  slot: z.enum(["core", "attackRing", "weightDisk", "tip", "launcher", "seal", "circuitChip"]),
  rarity: z.enum(["common", "tuned", "engraved", "relic"]),
  itemLevel: z.number().int().min(1),
  affixes: z.array(topRolledEngravingSchema).optional(),
  statBonuses: z.record(z.string(), z.number()),
  resistanceBonuses: z.record(z.string(), z.number()),
  modifiers: z.array(topModifierSchema),
  revision: z.number().int().min(0).optional(),
  locked: z.boolean().optional(),
  sourceDropId: z.string().optional(),
  generatedAt: z.string().optional(),
  generatedBy: z
    .object({
      arenaId: z.string(),
      enemyLevel: z.number(),
      balanceVersion: z.string(),
      seed: z.string(),
      source: z.enum(["drop", "starter", "craft", "debug"]),
    })
    .optional(),
});

const equipmentSaveSchema = z.object({
  core: topPartSaveSchema.nullable().optional(),
  attackRing: topPartSaveSchema.nullable().optional(),
  weightDisk: topPartSaveSchema.nullable().optional(),
  tip: topPartSaveSchema.nullable().optional(),
  launcher: topPartSaveSchema.nullable().optional(),
  seal: topPartSaveSchema.nullable().optional(),
  circuitChip: topPartSaveSchema.nullable().optional(),
});

const arenaRewardBiasSchema = z.object({
  target: z.string(),
  weight: z.number(),
});

const arenaKeyAffixSaveSchema = z.object({
  affixId: z.string(),
  displayName: z.string(),
  slot: z.enum(["prefix", "suffix"]),
  group: z.string(),
  tier: z.number(),
  enemyIntegrityMultiplier: z.number(),
  enemyImpactMultiplier: z.number(),
  enemyGuardMultiplier: z.number(),
  enemyRpmMultiplier: z.number(),
  rewardQuantity: z.number(),
  rewardRarity: z.number(),
  bossPressure: z.number(),
  rewardBias: z.array(arenaRewardBiasSchema),
});

export const arenaKeySaveSchema = z.object({
  id: z.string(),
  tier: z.number().int().min(1),
  arenaBaseId: z.string(),
  rarity: z.enum(["common", "tuned", "engraved", "relic"]),
  itemLevel: z.number().int().min(1),
  quality: z.number().min(0),
  prefixes: z.array(arenaKeyAffixSaveSchema),
  suffixes: z.array(arenaKeyAffixSaveSchema),
  rewardBias: z.array(arenaRewardBiasSchema),
  bossGateId: z.string().optional(),
  generatedAt: z.string(),
  generatedBy: z.object({
    arenaId: z.string(),
    balanceVersion: z.string(),
    seed: z.string(),
  }),
});

export const topAccountStateSchema = z.object({
  selectedFrameId: z.string(),
  selectedDriveId: z.string(),
  selectedArenaId: z.string(),
  equipment: equipmentSaveSchema,
  inventory: z.array(topPartSaveSchema),
  runeIds: z.array(z.string()).max(5),
  talentIds: z.array(z.string()),
  circuitAtlasNodeIds: z.array(z.string()).default([]),
  doctrineId: z.string().nullable().default(null),
  wallet: z.object({
    ash: z.number(),
    glass: z.number(),
    echo: z.number(),
  }),
  arenaKeys: z.array(arenaKeySaveSchema),
  clearedBossGateIds: z.array(z.string()),
  clearedRivalIds: z.array(z.string()).default([]),
  routeClears: z.record(z.string(), z.number()),
  totalKills: nonNegativeIntegerSchema,
  lastSettledAt: z.string(),
});

export const accountSaveSchema = z.object({
  schemaVersion: z.literal(5),
  accountId: z.string().nullable(),
  settings: z.object({
    reduceMotion: z.boolean(),
    compactNumbers: z.boolean(),
  }),
  roster: z.array(characterSaveSchema),
  sharedStash: z.object({
    itemIds: z.array(z.string()),
  }),
  currencies: z.record(z.string(), z.number()),
  top: topAccountStateSchema,
  achievements: z.record(z.string(), z.boolean()),
  lastSavedAt: z.string(),
});

export type AccountSave = z.infer<typeof accountSaveSchema>;
export type CharacterSave = z.infer<typeof characterSaveSchema>;

function starterFrameForClass(classId: string): string {
  if (classId === "ashweaver") {
    return "frame_ember_crucible";
  }
  if (classId === "ironbound") {
    return "frame_ember_crucible";
  }
  return "frame_swift_razor";
}

function starterDriveForFrame(frameId: string): string {
  if (frameId === "frame_ember_crucible") {
    return "drive_ember_scour";
  }
  if (frameId === "frame_storm_needle") {
    return "drive_storm_lattice";
  }
  return "drive_shard_barrage";
}

export function createNewAccountSave(classId = "veilrunner"): AccountSave {
  const starter = createStarterBuild(classId);
  const now = new Date().toISOString();
  const selectedFrameId = starterFrameForClass(classId);
  const selectedDriveId = starterDriveForFrame(selectedFrameId);

  return {
    schemaVersion: 5,
    accountId: null,
    settings: {
      reduceMotion: false,
      compactNumbers: false,
    },
    roster: [
      {
        id: starter.id,
        name: starter.name,
        classId: starter.classId,
        level: starter.level,
        xp: 0,
        selectedAreaId: "area_cinder_road",
        build: {
          skillId: starter.skillId,
          supportIds: starter.supportIds,
        },
        lastSettledAt: now,
      },
    ],
    sharedStash: {
      itemIds: [],
    },
    currencies: {
      ash: 0,
      glass: 0,
      echo: 0,
    },
    top: {
      selectedFrameId,
      selectedDriveId,
      selectedArenaId: "arena_cinder_crucible",
      equipment: createStarterEquipment(),
      inventory: createStarterInventory(),
      runeIds: [],
      talentIds: [],
      circuitAtlasNodeIds: [],
      doctrineId: null,
      wallet: {
        ash: 12,
        glass: 2,
        echo: 0,
      },
      arenaKeys: [],
      clearedBossGateIds: [],
      clearedRivalIds: [],
      routeClears: {},
      totalKills: 0,
      lastSettledAt: now,
    },
    achievements: {},
    lastSavedAt: now,
  };
}
