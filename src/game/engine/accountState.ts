import type { ArenaKey, TopPartInstance, TopPartSlotId } from "./topTypes";
import { defaultLootPolicy, type LootPolicy } from "./lootPolicy";
import type { EndgameMasterNodeIds } from "./endgameMasterAllocation";

export type AccountWallet = {
  ash: number;
  glass: number;
  echo: number;
};

export type RuneSlotState = [string | null, string | null, string | null];

export type AccountRuntimeState = {
  frameId: string;
  driveId: string;
  arenaId: string;
  equipment: Record<TopPartSlotId, TopPartInstance>;
  inventory: TopPartInstance[];
  runeSlots: RuneSlotState;
  talentIds: string[];
  circuitAtlasNodeIds: string[];
  doctrineId: string | null;
  wallet: AccountWallet;
  arenaKeys: ArenaKey[];
  clearedBossGateIds: string[];
  clearedRivalIds: string[];
  routeClears: Record<string, number>;
  totalKills: number;
  seenTutorialIds: string[];
  lootPolicy: LootPolicy;
  endgameMasterNodeIds: EndgameMasterNodeIds;
};

export type SaveTopLike = {
  selectedFrameId: string;
  selectedDriveId: string;
  selectedArenaId: string;
  equipment: Record<TopPartSlotId, TopPartInstance | null | undefined>;
  inventory: TopPartInstance[];
  runeIds: string[];
  talentIds: string[];
  circuitAtlasNodeIds: string[];
  doctrineId: string | null;
  wallet: AccountWallet;
  arenaKeys: ArenaKey[];
  clearedBossGateIds: string[];
  clearedRivalIds: string[];
  routeClears: Record<string, number>;
  totalKills: number;
  seenTutorialIds: string[];
  lootPolicy: LootPolicy;
  endgameMasterNodeIds: EndgameMasterNodeIds;
  lastSettledAt: string;
};

export function compactRuneSlots(slots: RuneSlotState): string[] {
  return slots.filter((runeId): runeId is string => Boolean(runeId));
}

export function toRuneSlots(runeIds: string[]): RuneSlotState {
  return [runeIds[0] ?? null, runeIds[1] ?? null, runeIds[2] ?? null];
}

function dedupePartsById(parts: TopPartInstance[]): TopPartInstance[] {
  const seenPartIds = new Set<string>();
  return parts.filter((part) => {
    if (seenPartIds.has(part.id)) {
      return false;
    }
    seenPartIds.add(part.id);
    return true;
  });
}

export function saveTopToAccountState(top: SaveTopLike, equipment: Record<TopPartSlotId, TopPartInstance>): AccountRuntimeState {
  return {
    frameId: top.selectedFrameId,
    driveId: top.selectedDriveId,
    arenaId: top.selectedArenaId,
    equipment,
    inventory: dedupePartsById(top.inventory),
    runeSlots: toRuneSlots(top.runeIds),
    talentIds: top.talentIds,
    circuitAtlasNodeIds: top.circuitAtlasNodeIds,
    doctrineId: top.doctrineId ?? null,
    wallet: top.wallet,
    arenaKeys: top.arenaKeys,
    clearedBossGateIds: top.clearedBossGateIds,
    clearedRivalIds: top.clearedRivalIds,
    routeClears: top.routeClears,
    totalKills: top.totalKills ?? 0,
    seenTutorialIds: top.seenTutorialIds ?? [],
    lootPolicy: top.lootPolicy ?? defaultLootPolicy,
    endgameMasterNodeIds: top.endgameMasterNodeIds ?? {},
  };
}

export function accountStateToSaveTop(state: AccountRuntimeState, lastSettledAt: string): SaveTopLike {
  return {
    selectedFrameId: state.frameId,
    selectedDriveId: state.driveId,
    selectedArenaId: state.arenaId,
    equipment: state.equipment,
    inventory: dedupePartsById(state.inventory),
    runeIds: compactRuneSlots(state.runeSlots),
    talentIds: state.talentIds,
    circuitAtlasNodeIds: state.circuitAtlasNodeIds,
    doctrineId: state.doctrineId,
    wallet: state.wallet,
    arenaKeys: state.arenaKeys,
    clearedBossGateIds: state.clearedBossGateIds,
    clearedRivalIds: state.clearedRivalIds,
    routeClears: state.routeClears,
    totalKills: state.totalKills,
    seenTutorialIds: state.seenTutorialIds,
    lootPolicy: state.lootPolicy,
    endgameMasterNodeIds: state.endgameMasterNodeIds,
    lastSettledAt,
  };
}
