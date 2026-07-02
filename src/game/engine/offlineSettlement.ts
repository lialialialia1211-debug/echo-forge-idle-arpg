import { getArenaCircuitDef } from "../data/arenaCircuits";
import { balanceConfig } from "../data/balanceConfig";
import { circuitNetworkNodes } from "../data/circuitNetwork";
import { namedRivals } from "../data/namedRivals";
import { createPartFromArenaDrop } from "../data/topParts";
import { projectTopCombat } from "./topCombat";
import { rollDropOutcome } from "./topDropRolls";
import { addWallet, salvageParts } from "./accountReducer";
import type { AccountWallet } from "./accountState";
import type { TopLoadoutConfig, TopPartInstance } from "./topTypes";
import { clamp } from "./math";

export type OfflineSettlementInput = {
  frameId: string;
  driveId: string;
  arenaId: string;
  circuitNodeId?: string;
  loadout: TopLoadoutConfig;
  elapsedSeconds: number;
  arenaTier: number;
  seed: string;
  partQuantity: number;
  partRarity: number;
};

export type OfflineSettlementResult = {
  effectiveSeconds: number;
  targetArenaId: string;
  targetArenaTier: number;
  circuitNodeId?: string;
  rivalUniqueDropsBlocked: boolean;
  kills: number;
  parts: TopPartInstance[];
  wallet: AccountWallet;
  cappedByTime: boolean;
};

const zeroWallet: AccountWallet = { ash: 0, glass: 0, echo: 0 };
const rivalUniqueBaseIds = new Set(namedRivals.flatMap((rival) => rival.uniqueDropBaseIds));

function killWallet(kills: number): AccountWallet {
  return {
    ash: Math.floor(kills * 0.16),
    glass: Math.floor(kills * 0.035),
    echo: Math.floor(kills * 0.002),
  };
}

function resolveOfflineTarget(input: OfflineSettlementInput) {
  const node = input.circuitNodeId ? circuitNetworkNodes.find((entry) => entry.id === input.circuitNodeId) : undefined;
  if (input.circuitNodeId && !node) {
    throw new Error(`Unknown circuit network node: ${input.circuitNodeId}`);
  }
  const arenaId = node?.arenaId ?? input.arenaId;
  const arena = getArenaCircuitDef(arenaId);
  const rivalUniqueDropsBlocked = Boolean(node?.requiredRivalId || node?.unlocksRivalId);
  return {
    arena,
    arenaId,
    arenaTier: node ? arena.tier : input.arenaTier,
    circuitNodeId: node?.id,
    rivalUniqueDropsBlocked,
  };
}

export function resolveOfflineSettlement(input: OfflineSettlementInput): OfflineSettlementResult {
  const effectiveSeconds = clamp(input.elapsedSeconds, 0, balanceConfig.offline.capSeconds);
  const cappedByTime = input.elapsedSeconds > balanceConfig.offline.capSeconds;
  const target = resolveOfflineTarget(input);

  if (effectiveSeconds <= 0) {
    return {
      effectiveSeconds: 0,
      targetArenaId: target.arenaId,
      targetArenaTier: target.arenaTier,
      circuitNodeId: target.circuitNodeId,
      rivalUniqueDropsBlocked: target.rivalUniqueDropsBlocked,
      kills: 0,
      parts: [],
      wallet: zeroWallet,
      cappedByTime,
    };
  }

  const projection = projectTopCombat({
    arenaId: target.arenaId,
    frameId: input.frameId,
    driveId: input.driveId,
    loadout: input.loadout,
  });
  const enemyEhp = target.arena.enemyIntegrity + target.arena.enemyIntegrity * 0.12;
  const survivalFactor = clamp((projection.sustainScore / 1.25) * (1 - projection.ringOutRisk), 0, 1);
  const killsPerSecond = (projection.totalDps / Math.max(1, enemyEhp)) * survivalFactor * balanceConfig.offline.efficiency;
  const kills = Math.max(0, Math.floor(killsPerSecond * effectiveSeconds));
  const parts: TopPartInstance[] = [];
  let overflowWallet = zeroWallet;

  for (let killIndex = 0; killIndex < kills; killIndex += 1) {
    const drop = rollDropOutcome({
      arenaId: target.arenaId,
      seed: `${input.seed}_offline_drop_${killIndex}`,
      wave: Math.max(1, Math.floor(killIndex / 10) + 1),
      killCount: killIndex,
      playerPartQuantity: input.partQuantity,
      playerPartRarity: input.partRarity,
    });

    if (!drop) {
      continue;
    }

    const safeDrop = target.rivalUniqueDropsBlocked && drop.rarity === "relic" ? { ...drop, rarity: "engraved" as const } : drop;
    const part = createPartFromArenaDrop(safeDrop, target.arenaTier, Math.max(1, Math.floor(killIndex / 10) + 1));
    if (target.rivalUniqueDropsBlocked && rivalUniqueBaseIds.has(part.baseId)) {
      continue;
    }
    if (parts.length < balanceConfig.offline.dropCap) {
      parts.push(part);
    } else {
      overflowWallet = addWallet(overflowWallet, salvageParts([part]));
    }
  }

  return {
    effectiveSeconds,
    targetArenaId: target.arenaId,
    targetArenaTier: target.arenaTier,
    circuitNodeId: target.circuitNodeId,
    rivalUniqueDropsBlocked: target.rivalUniqueDropsBlocked,
    kills,
    parts,
    wallet: addWallet(killWallet(kills), overflowWallet),
    cappedByTime,
  };
}
