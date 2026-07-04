import { endgameMasters } from "../data/endgameMasters";

export type EndgameMasterNodeIds = Record<string, string[]>;

export type WalletLike = {
  ash: number;
  glass: number;
  echo: number;
};

export type EndgameMasterRuntimeBonuses = {
  activeNodeCount: number;
  keySustainNodes: number;
  routeRewardNodes: number;
  materialLoopNodes: number;
  forgeControlNodes: number;
  affixControlNodes: number;
  rivalDuelNodes: number;
  bossGateNodes: number;
  uniqueChaseNodes: number;
  keyForgeAshDiscount: number;
  keyForgeGlassDiscount: number;
  forgeAshDiscount: number;
  forgeGlassDiscount: number;
  affixForgeAshDiscount: number;
  affixForgeGlassDiscount: number;
  salvageRewardMultiplier: number;
  mapClearRewardMultiplier: number;
};

export type EndgameForgeAction = "upgrade" | "rerollAffixes" | "rerollValues" | "add" | "remove";

const knownMasterIds = new Set(endgameMasters.map((master) => master.id));
const masterById = new Map(endgameMasters.map((master) => [master.id, master]));
const nodeById = new Map(endgameMasters.flatMap((master) => master.nodes.map((node) => [node.id, node] as const)));
const nodeToMasterId = new Map<string, string>();

for (const master of endgameMasters) {
  for (const node of master.nodes) {
    nodeToMasterId.set(node.id, master.id);
  }
}

function uniqueNodeIds(nodeIds: readonly string[]): string[] {
  return [...new Set(nodeIds)];
}

function sortMasterNodeIds(masterId: string, nodeIds: readonly string[]): string[] {
  const master = masterById.get(masterId);
  if (!master) {
    return [];
  }

  const order = new Map(master.nodes.map((node, index) => [node.id, index]));
  return [...nodeIds].sort((left, right) => (order.get(left) ?? 999) - (order.get(right) ?? 999));
}

export function getEndgameMasterIdForNode(nodeId: string): string | undefined {
  return nodeToMasterId.get(nodeId);
}

export function normalizeEndgameMasterNodeIds(input: EndgameMasterNodeIds | undefined): EndgameMasterNodeIds {
  if (!input) {
    return {};
  }

  const normalized: EndgameMasterNodeIds = {};

  for (const master of endgameMasters) {
    const requested = sortMasterNodeIds(master.id, uniqueNodeIds(input[master.id] ?? []));
    const accepted: string[] = [];

    for (const nodeId of requested) {
      if (accepted.length >= master.maxActiveNodes) {
        break;
      }

      const node = nodeById.get(nodeId);
      if (!node || getEndgameMasterIdForNode(node.id) !== master.id) {
        continue;
      }

      const requirements = node.requiredNodeIds ?? [];
      if (!requirements.every((requiredNodeId) => accepted.includes(requiredNodeId))) {
        continue;
      }

      accepted.push(node.id);
    }

    if (accepted.length > 0) {
      normalized[master.id] = accepted;
    }
  }

  return normalized;
}

export function activeEndgameMasterNodeIds(allocations: EndgameMasterNodeIds | undefined, masterId: string): string[] {
  return normalizeEndgameMasterNodeIds(allocations)[masterId] ?? [];
}

export function canAllocateEndgameMasterNode(
  allocations: EndgameMasterNodeIds | undefined,
  masterId: string,
  nodeId: string,
): boolean {
  const master = masterById.get(masterId);
  const node = nodeById.get(nodeId);
  if (!master || !node || getEndgameMasterIdForNode(node.id) !== master.id || !knownMasterIds.has(master.id)) {
    return false;
  }

  const activeNodeIds = activeEndgameMasterNodeIds(allocations, master.id);
  if (activeNodeIds.includes(node.id) || activeNodeIds.length >= master.maxActiveNodes) {
    return false;
  }

  return (node.requiredNodeIds ?? []).every((requiredNodeId) => activeNodeIds.includes(requiredNodeId));
}

export function canRefundEndgameMasterNode(
  allocations: EndgameMasterNodeIds | undefined,
  masterId: string,
  nodeId: string,
): boolean {
  const master = masterById.get(masterId);
  const node = nodeById.get(nodeId);
  if (!master || !node || getEndgameMasterIdForNode(node.id) !== master.id) {
    return false;
  }

  const activeNodeIds = activeEndgameMasterNodeIds(allocations, master.id);
  if (!activeNodeIds.includes(node.id)) {
    return false;
  }

  return activeNodeIds.every((activeNodeId) => {
    const activeNode = nodeById.get(activeNodeId);
    return !activeNode?.requiredNodeIds?.includes(node.id);
  });
}

export function allocateEndgameMasterNode(
  allocations: EndgameMasterNodeIds | undefined,
  masterId: string,
  nodeId: string,
): EndgameMasterNodeIds {
  if (!canAllocateEndgameMasterNode(allocations, masterId, nodeId)) {
    return normalizeEndgameMasterNodeIds(allocations);
  }

  const normalized = normalizeEndgameMasterNodeIds(allocations);
  return normalizeEndgameMasterNodeIds({
    ...normalized,
    [masterId]: [...(normalized[masterId] ?? []), nodeId],
  });
}

export function refundEndgameMasterNode(
  allocations: EndgameMasterNodeIds | undefined,
  masterId: string,
  nodeId: string,
): EndgameMasterNodeIds {
  if (!canRefundEndgameMasterNode(allocations, masterId, nodeId)) {
    return normalizeEndgameMasterNodeIds(allocations);
  }

  const normalized = normalizeEndgameMasterNodeIds(allocations);
  const remainingNodeIds = (normalized[masterId] ?? []).filter((activeNodeId) => activeNodeId !== nodeId);
  return normalizeEndgameMasterNodeIds({
    ...normalized,
    [masterId]: remainingNodeIds,
  });
}

export function resolveEndgameMasterBonuses(
  allocations: EndgameMasterNodeIds | undefined,
): EndgameMasterRuntimeBonuses {
  const normalized = normalizeEndgameMasterNodeIds(allocations);
  let activeNodeCount = 0;
  let keySustainNodes = 0;
  let routeRewardNodes = 0;
  let materialLoopNodes = 0;
  let forgeControlNodes = 0;
  let affixControlNodes = 0;
  let rivalDuelNodes = 0;
  let bossGateNodes = 0;
  let uniqueChaseNodes = 0;

  for (const nodeIds of Object.values(normalized)) {
    for (const nodeId of nodeIds) {
      const node = nodeById.get(nodeId);
      if (!node) {
        continue;
      }

      activeNodeCount += 1;
      if (node.rewardTarget === "keySustain") {
        keySustainNodes += 1;
      }
      if (node.rewardTarget === "routeReward") {
        routeRewardNodes += 1;
      }
      if (node.rewardTarget === "materialLoop") {
        materialLoopNodes += 1;
      }
      if (node.rewardTarget === "forgeControl") {
        forgeControlNodes += 1;
      }
      if (node.rewardTarget === "affixControl") {
        affixControlNodes += 1;
      }
      if (node.rewardTarget === "rivalDuel") {
        rivalDuelNodes += 1;
      }
      if (node.rewardTarget === "bossGate") {
        bossGateNodes += 1;
      }
      if (node.rewardTarget === "uniqueChase") {
        uniqueChaseNodes += 1;
      }
    }
  }

  return {
    activeNodeCount,
    keySustainNodes,
    routeRewardNodes,
    materialLoopNodes,
    forgeControlNodes,
    affixControlNodes,
    rivalDuelNodes,
    bossGateNodes,
    uniqueChaseNodes,
    keyForgeAshDiscount: keySustainNodes,
    keyForgeGlassDiscount: Math.floor(keySustainNodes / 3),
    forgeAshDiscount: forgeControlNodes + Math.floor(materialLoopNodes / 2),
    forgeGlassDiscount: Math.floor(forgeControlNodes / 2),
    affixForgeAshDiscount: affixControlNodes,
    affixForgeGlassDiscount: Math.floor(affixControlNodes / 2),
    salvageRewardMultiplier: 1 + materialLoopNodes * 0.12,
    mapClearRewardMultiplier: 1 + routeRewardNodes * 0.08 + materialLoopNodes * 0.03,
  };
}

export function applyEndgameKeyForgeCost(
  baseCost: WalletLike,
  allocations: EndgameMasterNodeIds | undefined,
): WalletLike {
  const bonuses = resolveEndgameMasterBonuses(allocations);
  return {
    ash: Math.max(baseCost.ash > 0 ? 1 : 0, baseCost.ash - bonuses.keyForgeAshDiscount),
    glass: Math.max(0, baseCost.glass - bonuses.keyForgeGlassDiscount),
    echo: baseCost.echo,
  };
}

export function applyEndgameMapClearReward(
  baseReward: WalletLike,
  allocations: EndgameMasterNodeIds | undefined,
): WalletLike {
  const bonuses = resolveEndgameMasterBonuses(allocations);
  if (bonuses.mapClearRewardMultiplier === 1) {
    return baseReward;
  }

  return {
    ash: Math.ceil(baseReward.ash * bonuses.mapClearRewardMultiplier),
    glass: Math.ceil(baseReward.glass * bonuses.mapClearRewardMultiplier),
    echo: Math.ceil(baseReward.echo * bonuses.mapClearRewardMultiplier),
  };
}

export function applyEndgameSalvageReward(
  baseReward: WalletLike,
  allocations: EndgameMasterNodeIds | undefined,
): WalletLike {
  const bonuses = resolveEndgameMasterBonuses(allocations);
  if (bonuses.salvageRewardMultiplier === 1) {
    return baseReward;
  }

  return {
    ash: Math.ceil(baseReward.ash * bonuses.salvageRewardMultiplier),
    glass: Math.ceil(baseReward.glass * bonuses.salvageRewardMultiplier),
    echo: Math.ceil(baseReward.echo * bonuses.salvageRewardMultiplier),
  };
}

export function applyEndgameForgeCost(
  baseCost: WalletLike,
  allocations: EndgameMasterNodeIds | undefined,
  action?: EndgameForgeAction,
): WalletLike {
  const bonuses = resolveEndgameMasterBonuses(allocations);
  const isAffixAction = action === "rerollAffixes" || action === "rerollValues" || action === "add" || action === "remove";
  const ashDiscount = bonuses.forgeAshDiscount + (isAffixAction ? bonuses.affixForgeAshDiscount : 0);
  const glassDiscount = bonuses.forgeGlassDiscount + (isAffixAction ? bonuses.affixForgeGlassDiscount : 0);

  return {
    ash: Math.max(baseCost.ash > 0 ? 1 : 0, baseCost.ash - ashDiscount),
    glass: Math.max(baseCost.glass > 0 ? 1 : 0, baseCost.glass - glassDiscount),
    echo: baseCost.echo,
  };
}
