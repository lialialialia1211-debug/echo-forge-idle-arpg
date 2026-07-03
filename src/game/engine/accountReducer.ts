import { circuitAtlasNodes, getCircuitAtlasNodeDef } from "../data/circuitAtlasNodes";
import { circuitNetworkNodes } from "../data/circuitNetwork";
import { getDoctrineDef } from "../data/doctrines";
import { getDriveCoreDef } from "../data/driveCores";
import { getArenaCircuitDef } from "../data/arenaCircuits";
import { getBossGateDef } from "../data/bossGates";
import { balanceConfig } from "../data/balanceConfig";
import { getNamedRivalDef } from "../data/namedRivals";
import { getTalentNodeDef, talentNodes } from "../data/talentNodes";
import { getTopFrameDef } from "../data/topFrames";
import { isRuneCompatible, tuningRunes } from "../data/tuningRunes";
import { validateRuneLoadout } from "./driveRuneValidation";
import { salvageTopPart, type TopCraftResult, type TopForgeWallet } from "./topCrafting";
import { generateTopPart } from "./topPartGeneration";
import type { ArenaKey, TopPartInstance } from "./topTypes";
import { compactRuneSlots, type AccountRuntimeState, type AccountWallet } from "./accountState";

export const inventoryCapacity = 48;
export const arenaKeyCapacity = 24;
export const keyForgeCost: AccountWallet = { ash: 6, glass: 1, echo: 0 };

export type AccountAction =
  | { type: "selectFrame"; frameId: string }
  | { type: "selectDrive"; driveId: string }
  | { type: "selectArena"; arenaId: string }
  | { type: "markBossGateCleared"; gateId: string }
  | { type: "clearRival"; rivalId: string }
  | { type: "equipPart"; part: TopPartInstance }
  | { type: "toggleLock"; partId: string }
  | { type: "salvagePart"; partId: string }
  | { type: "applyCraft"; sourcePartId: string; result: TopCraftResult }
  | { type: "assignRune"; runeId: string; socketIndex: number }
  | { type: "clearRuneSocket"; socketIndex: number }
  | { type: "allocateTalent"; talentId: string }
  | { type: "refundTalent"; talentId: string }
  | { type: "allocateAtlasNode"; nodeId: string }
  | { type: "refundAtlasNode"; nodeId: string }
  | { type: "selectDoctrine"; doctrineId: string | null }
  | { type: "forgeArenaKey"; key: ArenaKey; cost?: AccountWallet }
  | { type: "runArenaKey"; keyId: string }
  | { type: "ingestDrops"; parts: TopPartInstance[]; capacity?: number }
  | { type: "addWallet"; wallet: AccountWallet }
  | { type: "addKills"; amount: number }
  | { type: "addRouteClear"; arenaId: string; keys: ArenaKey[] }
  | { type: "markTutorialSeen"; tutorialId: string }
  | { type: "resetTutorialSeen" };

export function addWallet(left: AccountWallet, right: AccountWallet): AccountWallet {
  return {
    ash: left.ash + right.ash,
    glass: left.glass + right.glass,
    echo: left.echo + right.echo,
  };
}

export function canSpend(wallet: AccountWallet, cost: TopForgeWallet): boolean {
  return wallet.ash >= cost.ash && wallet.glass >= cost.glass && wallet.echo >= cost.echo;
}

export function spendWallet(wallet: AccountWallet, cost: TopForgeWallet): AccountWallet {
  return {
    ash: Math.max(0, wallet.ash - cost.ash),
    glass: Math.max(0, wallet.glass - cost.glass),
    echo: Math.max(0, wallet.echo - cost.echo),
  };
}

export function mergeInventoryParts(incoming: TopPartInstance[], current: TopPartInstance[], capacity: number): { items: TopPartInstance[]; overflow: TopPartInstance[] } {
  const items = [...incoming, ...current];
  const overflow: TopPartInstance[] = [];

  while (items.length > capacity) {
    let overflowIndex = -1;
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (!items[index].locked) {
        overflowIndex = index;
        break;
      }
    }

    const [removed] = items.splice(overflowIndex >= 0 ? overflowIndex : items.length - 1, 1);
    overflow.push(removed);
  }

  return { items, overflow };
}

export function salvageParts(parts: TopPartInstance[]): AccountWallet {
  return parts.reduce<AccountWallet>((wallet, part) => addWallet(wallet, salvageTopPart(part)), { ash: 0, glass: 0, echo: 0 });
}

function addWalletTimes(wallet: AccountWallet, reward: AccountWallet, times: number): AccountWallet {
  return {
    ash: wallet.ash + reward.ash * times,
    glass: wallet.glass + reward.glass * times,
    echo: wallet.echo + reward.echo * times,
  };
}

function addRewardParts(state: AccountRuntimeState, parts: TopPartInstance[]): AccountRuntimeState {
  if (parts.length === 0) {
    return state;
  }
  const merged = mergeInventoryParts(parts, state.inventory, inventoryCapacity);
  return {
    ...state,
    inventory: merged.items,
    wallet: merged.overflow.length > 0 ? addWallet(state.wallet, salvageParts(merged.overflow)) : state.wallet,
  };
}

function createRivalFirstClearPart(rivalId: string): TopPartInstance | null {
  const rival = getNamedRivalDef(rivalId);
  const baseId = rival.uniqueDropBaseIds[0];
  if (!baseId) {
    return null;
  }
  const node = circuitNetworkNodes.find((entry) => entry.id === rival.circuitNodeId);
  const arena = node ? getArenaCircuitDef(node.arenaId) : getArenaCircuitDef("arena_cinder_crucible");
  return generateTopPart({
    id: `first_clear_${rival.id}_${baseId}`,
    baseId,
    rarity: balanceConfig.drops.firstClear.rival.rarity,
    itemLevel: Math.max(balanceConfig.drops.firstClear.rival.itemLevel, arena.enemyLevel),
    seed: `first_clear_${rival.id}_${baseId}`,
    arenaId: arena.id,
    enemyLevel: arena.enemyLevel,
    source: "drop",
    sourceDropId: `first_clear_${rival.id}`,
    locked: true,
  });
}

function createBossGateFirstClearPart(gateId: string): TopPartInstance {
  const gate = getBossGateDef(gateId);
  const arena = getArenaCircuitDef(gate.arenaId);
  return generateTopPart({
    id: `first_clear_${gate.id}_${balanceConfig.drops.firstClear.bossGate.baseId}`,
    baseId: balanceConfig.drops.firstClear.bossGate.baseId,
    rarity: balanceConfig.drops.firstClear.bossGate.rarity,
    itemLevel: Math.max(balanceConfig.drops.firstClear.bossGate.itemLevel, arena.enemyLevel),
    seed: `first_clear_${gate.id}_${balanceConfig.drops.firstClear.bossGate.baseId}`,
    arenaId: arena.id,
    enemyLevel: arena.enemyLevel,
    source: "drop",
    sourceDropId: `first_clear_${gate.id}`,
    locked: true,
  });
}

function mapClearReward(arenaId: string, clears: number): AccountWallet {
  const arena = getArenaCircuitDef(arenaId);
  return {
    ash: balanceConfig.progression.mapClearReward.ashPerTier * arena.tier * clears,
    glass: balanceConfig.progression.mapClearReward.glassPerTier * arena.tier * clears,
    echo: 0,
  };
}

export function talentPointTotal(totalKills: number): number {
  return 3 + Math.floor(Math.max(0, totalKills) / 5);
}

export function spentTalentPoints(talentIds: string[]): number {
  return talentIds.reduce((total, id) => total + getTalentNodeDef(id).cost, 0);
}

export function availableTalentPoints(state: Pick<AccountRuntimeState, "talentIds" | "totalKills">): number {
  return talentPointTotal(state.totalKills) - spentTalentPoints(state.talentIds);
}

export function atlasPointTotal(totalKills: number, routeClears: Record<string, number>): number {
  return Math.floor(Math.max(0, totalKills) / 28) + Object.values(routeClears).reduce((total, clears) => total + Math.max(0, Math.floor(clears)), 0);
}

export function spentAtlasPoints(nodeIds: string[]): number {
  return nodeIds.reduce((total, id) => total + getCircuitAtlasNodeDef(id).cost, 0);
}

export function availableAtlasPoints(state: Pick<AccountRuntimeState, "circuitAtlasNodeIds" | "routeClears" | "totalKills">): number {
  return Math.max(0, atlasPointTotal(state.totalKills, state.routeClears) - spentAtlasPoints(state.circuitAtlasNodeIds));
}

export function isTalentReachable(allocatedTalentIds: string[], talentId: string): boolean {
  const allowed = new Set([...allocatedTalentIds, talentId]);
  const roots = talentNodes.filter((node) => (!node.requiredNodeIds || node.requiredNodeIds.length === 0) && allowed.has(node.id)).map((node) => node.id);
  const reachable = new Set<string>(roots);
  const queue = [...roots];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const node of talentNodes) {
      if (!allowed.has(node.id) || reachable.has(node.id)) {
        continue;
      }
      if ((node.requiredNodeIds ?? []).includes(currentId)) {
        reachable.add(node.id);
        queue.push(node.id);
      }
    }
  }

  return reachable.has(talentId);
}

function canRefundTalent(talentIds: string[], talentId: string): boolean {
  const remainingTalentIds = talentIds.filter((id) => id !== talentId);
  return remainingTalentIds.every((id) => isTalentReachable(remainingTalentIds, id));
}

function canAllocateTalent(state: AccountRuntimeState, talentId: string): boolean {
  if (state.talentIds.includes(talentId)) {
    return false;
  }
  const node = getTalentNodeDef(talentId);
  const requiredNodeIds = node.requiredNodeIds ?? [];
  const requirementsMet = requiredNodeIds.length === 0 || requiredNodeIds.some((requiredId) => state.talentIds.includes(requiredId));
  return requirementsMet && isTalentReachable(state.talentIds, talentId) && availableTalentPoints(state) >= node.cost;
}

function canRefundAtlasNode(nodeIds: string[], nodeId: string): boolean {
  return !circuitAtlasNodes.some((node) => nodeIds.includes(node.id) && (node.requiredNodeIds ?? []).includes(nodeId));
}

function canAllocateAtlasNode(state: AccountRuntimeState, nodeId: string): boolean {
  if (state.circuitAtlasNodeIds.includes(nodeId)) {
    return false;
  }
  const node = getCircuitAtlasNodeDef(nodeId);
  const requirementsMet = (node.requiredNodeIds ?? []).every((requiredId) => state.circuitAtlasNodeIds.includes(requiredId));
  return requirementsMet && availableAtlasPoints(state) >= node.cost;
}

function canSelectDoctrine(state: AccountRuntimeState, doctrineId: string | null): boolean {
  if (!doctrineId) {
    return true;
  }
  try {
    return getDoctrineDef(doctrineId).frameId === state.frameId;
  } catch {
    return false;
  }
}

function clearIncompatibleRunes(driveId: string, runeSlots: AccountRuntimeState["runeSlots"]): AccountRuntimeState["runeSlots"] {
  const drive = getDriveCoreDef(driveId);
  return runeSlots.map((runeId) => {
    if (!runeId) {
      return null;
    }
    const rune = tuningRunes.find((entry) => entry.id === runeId);
    return rune && isRuneCompatible(rune, drive.tags) ? runeId : null;
  }) as AccountRuntimeState["runeSlots"];
}

function replacePartEverywhere(state: AccountRuntimeState, sourcePartId: string, nextPart: TopPartInstance): AccountRuntimeState {
  const equippedSlot = Object.entries(state.equipment).find(([, part]) => part.id === sourcePartId)?.[0] as keyof AccountRuntimeState["equipment"] | undefined;
  return {
    ...state,
    equipment: equippedSlot ? { ...state.equipment, [equippedSlot]: nextPart } : state.equipment,
    inventory: state.inventory.map((part) => (part.id === sourcePartId ? nextPart : part)),
  };
}

export function accountReducer(state: AccountRuntimeState, action: AccountAction): AccountRuntimeState {
  switch (action.type) {
    case "selectFrame": {
      const frame = getTopFrameDef(action.frameId);
      const nextDriveId = frame.startingDriveId;
      const nextState = {
        ...state,
        frameId: action.frameId,
        driveId: nextDriveId,
        runeSlots: clearIncompatibleRunes(nextDriveId, state.runeSlots),
      };
      return {
        ...nextState,
        doctrineId: canSelectDoctrine(nextState, nextState.doctrineId) ? nextState.doctrineId : null,
      };
    }

    case "selectDrive":
      getDriveCoreDef(action.driveId);
      return {
        ...state,
        driveId: action.driveId,
        runeSlots: clearIncompatibleRunes(action.driveId, state.runeSlots),
      };

    case "selectArena":
      getArenaCircuitDef(action.arenaId);
      return { ...state, arenaId: action.arenaId };

    case "markBossGateCleared": {
      getBossGateDef(action.gateId);
      if (state.clearedBossGateIds.includes(action.gateId)) {
        return state;
      }
      const rewarded = addRewardParts(
        {
          ...state,
          clearedBossGateIds: [...state.clearedBossGateIds, action.gateId],
          wallet: addWallet(state.wallet, balanceConfig.drops.firstClear.bossGate.wallet),
        },
        [createBossGateFirstClearPart(action.gateId)],
      );
      return rewarded;
    }

    case "clearRival": {
      getNamedRivalDef(action.rivalId);
      if (state.clearedRivalIds.includes(action.rivalId)) {
        return state;
      }
      const part = createRivalFirstClearPart(action.rivalId);
      return addRewardParts(
        {
          ...state,
          clearedRivalIds: [...state.clearedRivalIds, action.rivalId],
          wallet: addWallet(state.wallet, balanceConfig.drops.firstClear.rival.wallet),
        },
        part ? [part] : [],
      );
    }

    case "equipPart": {
      const replaced = state.equipment[action.part.slot];
      const withoutEquipped = state.inventory.filter((part) => part.id !== action.part.id);
      const inventory = replaced && replaced.id !== action.part.id ? [replaced, ...withoutEquipped].slice(0, inventoryCapacity) : withoutEquipped;
      return {
        ...state,
        equipment: { ...state.equipment, [action.part.slot]: action.part },
        inventory,
      };
    }

    case "toggleLock": {
      const toggle = (part: TopPartInstance) => (part.id === action.partId ? { ...part, locked: !part.locked } : part);
      return {
        ...state,
        equipment: Object.fromEntries(Object.entries(state.equipment).map(([slot, part]) => [slot, toggle(part)])) as AccountRuntimeState["equipment"],
        inventory: state.inventory.map(toggle),
      };
    }

    case "salvagePart": {
      const part = state.inventory.find((item) => item.id === action.partId);
      if (!part || part.locked) {
        return state;
      }
      return {
        ...state,
        inventory: state.inventory.filter((item) => item.id !== action.partId),
        wallet: addWallet(state.wallet, salvageTopPart(part)),
      };
    }

    case "applyCraft": {
      if (!canSpend(state.wallet, action.result.spent)) {
        return state;
      }
      return replacePartEverywhere(
        {
          ...state,
          wallet: spendWallet(state.wallet, action.result.spent),
        },
        action.sourcePartId,
        action.result.part,
      );
    }

    case "assignRune": {
      const rune = tuningRunes.find((entry) => entry.id === action.runeId);
      const drive = getDriveCoreDef(state.driveId);
      if (!rune || !isRuneCompatible(rune, drive.tags)) {
        return state;
      }
      const socketIndex = Math.max(0, Math.min(2, action.socketIndex));
      const runeSlots = state.runeSlots.map((currentRuneId) => (currentRuneId === action.runeId ? null : currentRuneId)) as AccountRuntimeState["runeSlots"];
      runeSlots[socketIndex] = action.runeId;
      const validRuneIds = new Set(validateRuneLoadout(state.driveId, compactRuneSlots(runeSlots)).validRuneIds);
      return { ...state, runeSlots: runeSlots.map((runeId) => (runeId && validRuneIds.has(runeId) ? runeId : null)) as AccountRuntimeState["runeSlots"] };
    }

    case "clearRuneSocket": {
      const socketIndex = Math.max(0, Math.min(2, action.socketIndex));
      if (!state.runeSlots[socketIndex]) {
        return state;
      }
      const runeSlots = [...state.runeSlots] as AccountRuntimeState["runeSlots"];
      runeSlots[socketIndex] = null;
      return { ...state, runeSlots };
    }

    case "allocateTalent":
      return canAllocateTalent(state, action.talentId) ? { ...state, talentIds: [...state.talentIds, action.talentId] } : state;

    case "refundTalent":
      return state.talentIds.includes(action.talentId) && canRefundTalent(state.talentIds, action.talentId) ? { ...state, talentIds: state.talentIds.filter((id) => id !== action.talentId) } : state;

    case "allocateAtlasNode":
      return canAllocateAtlasNode(state, action.nodeId) ? { ...state, circuitAtlasNodeIds: [...state.circuitAtlasNodeIds, action.nodeId] } : state;

    case "refundAtlasNode":
      return state.circuitAtlasNodeIds.includes(action.nodeId) && canRefundAtlasNode(state.circuitAtlasNodeIds, action.nodeId)
        ? { ...state, circuitAtlasNodeIds: state.circuitAtlasNodeIds.filter((id) => id !== action.nodeId) }
        : state;

    case "selectDoctrine":
      return canSelectDoctrine(state, action.doctrineId) ? { ...state, doctrineId: action.doctrineId } : state;

    case "forgeArenaKey": {
      const cost = action.cost ?? keyForgeCost;
      if (!canSpend(state.wallet, cost)) {
        return state;
      }
      return {
        ...state,
        wallet: spendWallet(state.wallet, cost),
        arenaKeys: [action.key, ...state.arenaKeys].slice(0, arenaKeyCapacity),
      };
    }

    case "runArenaKey": {
      const key = state.arenaKeys.find((entry) => entry.id === action.keyId);
      if (!key) {
        return state;
      }
      return {
        ...state,
        arenaId: key.arenaBaseId,
        arenaKeys: state.arenaKeys.filter((entry) => entry.id !== action.keyId),
      };
    }

    case "ingestDrops": {
      const merged = mergeInventoryParts(action.parts, state.inventory, action.capacity ?? inventoryCapacity);
      return {
        ...state,
        inventory: merged.items,
        wallet: merged.overflow.length > 0 ? addWallet(state.wallet, salvageParts(merged.overflow)) : state.wallet,
      };
    }

    case "addWallet":
      return {
        ...state,
        wallet: addWallet(state.wallet, action.wallet),
      };

    case "addKills":
      return {
        ...state,
        totalKills: state.totalKills + Math.max(0, Math.floor(action.amount)),
      };

    case "addRouteClear": {
      const clears = Math.max(1, action.keys.length);
      return {
        ...state,
        wallet: addWalletTimes(state.wallet, mapClearReward(action.arenaId, clears), 1),
        routeClears: { ...state.routeClears, [action.arenaId]: (state.routeClears[action.arenaId] ?? 0) + clears },
        arenaKeys: [...action.keys, ...state.arenaKeys].slice(0, arenaKeyCapacity),
      };
    }

    case "markTutorialSeen":
      return state.seenTutorialIds.includes(action.tutorialId)
        ? state
        : { ...state, seenTutorialIds: [...state.seenTutorialIds, action.tutorialId] };

    case "resetTutorialSeen":
      return state.seenTutorialIds.length === 0 ? state : { ...state, seenTutorialIds: [] };

    default:
      return state;
  }
}
