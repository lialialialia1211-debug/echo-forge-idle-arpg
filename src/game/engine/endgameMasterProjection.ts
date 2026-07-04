import { endgameMasters, getEndgameMasterDef, type EndgameMasterDef, type EndgameMasterSignal } from "../data/endgameMasters";
import type { AccountWallet } from "./accountState";
import { clamp } from "./math";
import type { ArenaKey } from "./topTypes";

export type EndgameMasterProjectionInput = {
  arenaKeys?: ArenaKey[];
  clearedBossGateIds?: string[];
  clearedRivalIds?: string[];
  routeClears?: Record<string, number>;
  totalKills?: number;
  wallet?: AccountWallet;
};

export type EndgameMasterSignalProjection = {
  signal: EndgameMasterSignal;
  value: number;
  target: number;
  progress: number;
  weight: number;
};

export type EndgameMasterProjection = {
  masterId: string;
  readiness: number;
  activeSignal: EndgameMasterSignal;
  signalProgress: EndgameMasterSignalProjection[];
  suggestedNodeIds: string[];
  missingSignals: EndgameMasterSignal[];
};

const tierReadinessThreshold: Record<1 | 2 | 3 | 4, number> = {
  1: 0,
  2: 0.18,
  3: 0.42,
  4: 0.66,
};

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function walletScore(wallet?: AccountWallet): number {
  if (!wallet) {
    return 0;
  }
  return Math.max(0, wallet.ash) + Math.max(0, wallet.glass) * 3 + Math.max(0, wallet.echo) * 6;
}

function totalRouteClears(routeClears?: Record<string, number>): number {
  return Object.values(routeClears ?? {}).reduce((total, clears) => total + Math.max(0, Math.floor(clears)), 0);
}

function signalValue(signal: EndgameMasterSignal, input: EndgameMasterProjectionInput): number {
  if (signal === "routeClears") {
    return totalRouteClears(input.routeClears);
  }
  if (signal === "arenaKeys") {
    return input.arenaKeys?.length ?? 0;
  }
  if (signal === "materials") {
    return walletScore(input.wallet);
  }
  if (signal === "bossGates") {
    return input.clearedBossGateIds?.length ?? 0;
  }
  if (signal === "rivals") {
    return input.clearedRivalIds?.length ?? 0;
  }
  return Math.max(0, Math.floor(input.totalKills ?? 0));
}

function buildSignalProgress(master: EndgameMasterDef, input: EndgameMasterProjectionInput): EndgameMasterSignalProjection[] {
  return master.signalWeights.map((entry) => {
    const value = signalValue(entry.signal, input);
    return {
      signal: entry.signal,
      value,
      target: entry.target,
      progress: roundRatio(clamp(value / Math.max(1, entry.target), 0, 1)),
      weight: entry.weight,
    };
  });
}

function nodeScore(master: EndgameMasterDef, signalProgress: EndgameMasterSignalProjection[], readiness: number, nodeId: string): number {
  const node = master.nodes.find((entry) => entry.id === nodeId);
  if (!node) {
    return 0;
  }
  const progress = signalProgress.find((entry) => entry.signal === node.signal)?.progress ?? 0;
  const threshold = tierReadinessThreshold[node.tier];
  const thresholdBonus = readiness >= threshold ? 0.35 : 0;
  return progress * 1.8 + node.weight + thresholdBonus - node.tier * 0.05;
}

export function projectEndgameMaster(masterId: string, input: EndgameMasterProjectionInput): EndgameMasterProjection {
  const master = getEndgameMasterDef(masterId);
  const signalProgress = buildSignalProgress(master, input);
  const weightTotal = signalProgress.reduce((total, entry) => total + entry.weight, 0);
  const readiness = roundRatio(signalProgress.reduce((total, entry) => total + entry.progress * entry.weight, 0) / Math.max(1, weightTotal));
  const activeSignal = signalProgress.reduce((best, entry) => (entry.progress * entry.weight > best.progress * best.weight ? entry : best), signalProgress[0]).signal;
  const missingSignals = signalProgress
    .filter((entry) => entry.progress < 0.5)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 2)
    .map((entry) => entry.signal);
  const suggestedNodeIds = master.nodes
    .filter((node) => readiness + 0.24 >= tierReadinessThreshold[node.tier])
    .map((node) => node.id)
    .sort((left, right) => nodeScore(master, signalProgress, readiness, right) - nodeScore(master, signalProgress, readiness, left))
    .slice(0, master.maxActiveNodes)
    .sort((left, right) => {
      const leftNode = master.nodes.find((node) => node.id === left)!;
      const rightNode = master.nodes.find((node) => node.id === right)!;
      return leftNode.tier - rightNode.tier || left.localeCompare(right);
    });

  return {
    masterId,
    readiness,
    activeSignal,
    signalProgress,
    suggestedNodeIds,
    missingSignals,
  };
}

export function projectAllEndgameMasters(input: EndgameMasterProjectionInput): EndgameMasterProjection[] {
  return endgameMasters.map((master) => projectEndgameMaster(master.id, input));
}
