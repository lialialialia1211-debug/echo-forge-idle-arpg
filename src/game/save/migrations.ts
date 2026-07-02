import { accountSaveSchema, type AccountSave } from "./schema";
import { arenaKeyAffixes } from "../data/arenaKeyAffixes";
import { arenaCircuits } from "../data/arenaCircuits";
import { bossGates } from "../data/bossGates";
import { circuitAtlasNodes } from "../data/circuitAtlasNodes";
import { doctrines } from "../data/doctrines";
import { driveCores } from "../data/driveCores";
import { talentNodes } from "../data/talentNodes";
import { createStarterEquipment, createStarterInventory, partSlotOrder } from "../data/topParts";
import { topPartBases } from "../data/topPartBases";
import { topFrames } from "../data/topFrames";
import { isArenaKeyLegal } from "../engine/arenaKeys";
import { validateRuneLoadout } from "../engine/driveRuneValidation";
import { isTopPartLegal } from "../engine/topCrafting";
import type { ArenaKey, TopPartInstance, TopPartSlotId } from "../engine/topTypes";

type LegacyV1Save = {
  schemaVersion: 1;
  accountId: string | null;
  settings: {
    reduceMotion: boolean;
    compactNumbers: boolean;
  };
  roster: AccountSave["roster"];
  sharedStash: {
    itemIds: string[];
  };
  currencies: Record<string, number>;
  achievements: Record<string, boolean>;
  lastSavedAt: string;
};

type LegacyV2Save = Omit<AccountSave, "schemaVersion" | "top"> & {
  schemaVersion: 2;
  top: Omit<AccountSave["top"], "totalKills" | "doctrineId"> & Partial<Pick<AccountSave["top"], "totalKills" | "doctrineId">>;
};

type LegacyV3Save = Omit<AccountSave, "schemaVersion" | "top"> & {
  schemaVersion: 3;
  top: Omit<AccountSave["top"], "doctrineId"> & Partial<Pick<AccountSave["top"], "doctrineId">>;
};

type SavedTopPart = AccountSave["top"]["inventory"][number];
type SavedArenaKey = AccountSave["top"]["arenaKeys"][number];

function starterTopStateForLegacy(save: LegacyV1Save): AccountSave["top"] {
  const classId = save.roster[0]?.classId ?? "veilrunner";
  const selectedFrameId = classId === "ashweaver" || classId === "ironbound" ? "frame_ember_crucible" : "frame_swift_razor";
  const selectedDriveId = selectedFrameId === "frame_ember_crucible" ? "drive_ember_scour" : "drive_shard_barrage";

  return {
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
      ash: save.currencies.ash ?? 0,
      glass: save.currencies.glass ?? 0,
      echo: save.currencies.echo ?? 0,
    },
    arenaKeys: [],
    clearedBossGateIds: [],
    routeClears: {},
    totalKills: 0,
    lastSettledAt: save.lastSavedAt,
  };
}

function isLegacyV1Save(input: unknown): input is LegacyV1Save {
  return Boolean(input && typeof input === "object" && "schemaVersion" in input && (input as { schemaVersion?: unknown }).schemaVersion === 1);
}

function isLegacyV2Save(input: unknown): input is LegacyV2Save {
  return Boolean(input && typeof input === "object" && "schemaVersion" in input && (input as { schemaVersion?: unknown }).schemaVersion === 2);
}

function isLegacyV3Save(input: unknown): input is LegacyV3Save {
  return Boolean(input && typeof input === "object" && "schemaVersion" in input && (input as { schemaVersion?: unknown }).schemaVersion === 3);
}

const defaultFrameId = "frame_swift_razor";
const defaultArenaId = "arena_cinder_crucible";
const frameIds = new Set(topFrames.map((entry) => entry.id));
const driveIds = new Set(driveCores.map((entry) => entry.id));
const arenaIds = new Set(arenaCircuits.map((entry) => entry.id));
const partBaseIds = new Set(topPartBases.map((entry) => entry.id));
const talentIds = new Set(talentNodes.map((entry) => entry.id));
const circuitAtlasNodeIds = new Set(circuitAtlasNodes.map((entry) => entry.id));
const doctrineIds = new Set(doctrines.map((entry) => entry.id));
const arenaKeyAffixIds = new Set(arenaKeyAffixes.map((entry) => entry.id));
const bossGateIds = new Set(bossGates.map((entry) => entry.id));

function clampCurrency(value: number): number {
  return Math.max(0, Math.floor(value));
}

function driveForFrame(frameId: string): string {
  return topFrames.find((entry) => entry.id === frameId)?.startingDriveId ?? "drive_shard_barrage";
}

function isLegalSavedPart(part: SavedTopPart, expectedSlot?: TopPartSlotId): boolean {
  try {
    if (expectedSlot && part.slot !== expectedSlot) {
      return false;
    }
    if (!partBaseIds.has(part.baseId)) {
      return false;
    }
    return isTopPartLegal(part as TopPartInstance);
  } catch {
    return false;
  }
}

function sanitizeEquipment(equipment: AccountSave["top"]["equipment"]): AccountSave["top"]["equipment"] {
  const starterEquipment = createStarterEquipment();

  return partSlotOrder.reduce<AccountSave["top"]["equipment"]>((next, slot) => {
    const part = equipment[slot];
    next[slot] = part && isLegalSavedPart(part, slot) ? part : starterEquipment[slot];
    return next;
  }, {});
}

function sanitizeInventory(inventory: AccountSave["top"]["inventory"]): AccountSave["top"]["inventory"] {
  const seenIds = new Set<string>();
  const legalParts = inventory.filter((part) => {
    if (seenIds.has(part.id) || !isLegalSavedPart(part)) {
      return false;
    }
    seenIds.add(part.id);
    return true;
  });

  return legalParts.length > 0 ? legalParts : createStarterInventory();
}

function isLegalArenaKey(key: SavedArenaKey): boolean {
  try {
    const affixes = [...key.prefixes, ...key.suffixes];
    return (
      arenaIds.has(key.arenaBaseId) &&
      (!key.bossGateId || bossGateIds.has(key.bossGateId)) &&
      affixes.every((affix) => arenaKeyAffixIds.has(affix.affixId)) &&
      isArenaKeyLegal(key as ArenaKey)
    );
  } catch {
    return false;
  }
}

function sanitizeArenaKeys(keys: AccountSave["top"]["arenaKeys"]): AccountSave["top"]["arenaKeys"] {
  const seenIds = new Set<string>();
  return keys.filter((key) => {
    if (seenIds.has(key.id) || !isLegalArenaKey(key)) {
      return false;
    }
    seenIds.add(key.id);
    return true;
  });
}

function sanitizeRouteClears(routeClears: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(routeClears)
      .filter(([arenaId]) => arenaIds.has(arenaId))
      .map(([arenaId, clearCount]) => [arenaId, Math.max(0, Math.floor(clearCount))]),
  );
}

function sanitizeDoctrineId(doctrineId: string | null | undefined, frameId: string): string | null {
  if (!doctrineId || !doctrineIds.has(doctrineId)) {
    return null;
  }
  return doctrines.find((entry) => entry.id === doctrineId)?.frameId === frameId ? doctrineId : null;
}

export function sanitizeAccountSave(save: AccountSave): AccountSave {
  const selectedFrameId = frameIds.has(save.top.selectedFrameId) ? save.top.selectedFrameId : defaultFrameId;
  const selectedDriveId = driveIds.has(save.top.selectedDriveId) ? save.top.selectedDriveId : driveForFrame(selectedFrameId);
  const selectedArenaId = arenaIds.has(save.top.selectedArenaId) ? save.top.selectedArenaId : defaultArenaId;
  const runeIds = validateRuneLoadout(selectedDriveId, save.top.runeIds).validRuneIds;

  return {
    ...save,
    currencies: Object.fromEntries(Object.entries(save.currencies).map(([currency, value]) => [currency, clampCurrency(value)])),
    top: {
      ...save.top,
      selectedFrameId,
      selectedDriveId,
      selectedArenaId,
      equipment: sanitizeEquipment(save.top.equipment),
      inventory: sanitizeInventory(save.top.inventory),
      runeIds,
      talentIds: save.top.talentIds.filter((talentId) => talentIds.has(talentId)),
      circuitAtlasNodeIds: save.top.circuitAtlasNodeIds.filter((nodeId) => circuitAtlasNodeIds.has(nodeId)),
      doctrineId: sanitizeDoctrineId(save.top.doctrineId, selectedFrameId),
      wallet: {
        ash: clampCurrency(save.top.wallet.ash),
        glass: clampCurrency(save.top.wallet.glass),
        echo: clampCurrency(save.top.wallet.echo),
      },
      arenaKeys: sanitizeArenaKeys(save.top.arenaKeys),
      clearedBossGateIds: save.top.clearedBossGateIds.filter((gateId) => bossGateIds.has(gateId)),
      routeClears: sanitizeRouteClears(save.top.routeClears),
      totalKills: Math.max(0, Math.floor(save.top.totalKills ?? 0)),
    },
  };
}

export function migrateUnknownSave(input: unknown): AccountSave {
  if (isLegacyV1Save(input)) {
    return sanitizeAccountSave(accountSaveSchema.parse({
      ...input,
      schemaVersion: 4,
      top: starterTopStateForLegacy(input),
    }));
  }

  if (isLegacyV2Save(input)) {
    return sanitizeAccountSave(accountSaveSchema.parse({
      ...input,
      schemaVersion: 4,
      top: {
        ...input.top,
        totalKills: input.top.totalKills ?? 0,
        doctrineId: input.top.doctrineId ?? null,
      },
    }));
  }

  if (isLegacyV3Save(input)) {
    return sanitizeAccountSave(accountSaveSchema.parse({
      ...input,
      schemaVersion: 4,
      top: {
        ...input.top,
        doctrineId: input.top.doctrineId ?? null,
      },
    }));
  }

  return sanitizeAccountSave(accountSaveSchema.parse(input));
}
