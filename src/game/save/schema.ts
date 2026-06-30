import { z } from "zod";
import { createStarterBuild } from "../engine/character";

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

export const accountSaveSchema = z.object({
  schemaVersion: z.literal(1),
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
  achievements: z.record(z.string(), z.boolean()),
  lastSavedAt: z.string(),
});

export type AccountSave = z.infer<typeof accountSaveSchema>;
export type CharacterSave = z.infer<typeof characterSaveSchema>;

export function createNewAccountSave(classId = "veilrunner"): AccountSave {
  const starter = createStarterBuild(classId);
  const now = new Date().toISOString();

  return {
    schemaVersion: 1,
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
    achievements: {},
    lastSavedAt: now,
  };
}
