import { getArenaCircuitDef } from "../data/arenaCircuits";
import { balanceConfig } from "../data/balanceConfig";
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
  loadout: TopLoadoutConfig;
  elapsedSeconds: number;
  arenaTier: number;
  seed: string;
  partQuantity: number;
  partRarity: number;
};

export type OfflineSettlementResult = {
  effectiveSeconds: number;
  kills: number;
  parts: TopPartInstance[];
  wallet: AccountWallet;
  cappedByTime: boolean;
};

const zeroWallet: AccountWallet = { ash: 0, glass: 0, echo: 0 };

function killWallet(kills: number): AccountWallet {
  return {
    ash: Math.floor(kills * 0.16),
    glass: Math.floor(kills * 0.035),
    echo: Math.floor(kills * 0.002),
  };
}

export function resolveOfflineSettlement(input: OfflineSettlementInput): OfflineSettlementResult {
  const effectiveSeconds = clamp(input.elapsedSeconds, 0, balanceConfig.offline.capSeconds);
  const cappedByTime = input.elapsedSeconds > balanceConfig.offline.capSeconds;

  if (effectiveSeconds <= 0) {
    return {
      effectiveSeconds: 0,
      kills: 0,
      parts: [],
      wallet: zeroWallet,
      cappedByTime,
    };
  }

  const arena = getArenaCircuitDef(input.arenaId);
  const projection = projectTopCombat({
    arenaId: input.arenaId,
    frameId: input.frameId,
    driveId: input.driveId,
    loadout: input.loadout,
  });
  const enemyEhp = arena.enemyIntegrity + arena.enemyIntegrity * 0.12;
  const survivalFactor = clamp((projection.sustainScore / 1.25) * (1 - projection.ringOutRisk), 0, 1);
  const killsPerSecond = (projection.totalDps / Math.max(1, enemyEhp)) * survivalFactor * balanceConfig.offline.efficiency;
  const kills = Math.max(0, Math.floor(killsPerSecond * effectiveSeconds));
  const parts: TopPartInstance[] = [];
  let overflowWallet = zeroWallet;

  for (let killIndex = 0; killIndex < kills; killIndex += 1) {
    const drop = rollDropOutcome({
      arenaId: input.arenaId,
      seed: `${input.seed}_offline_drop_${killIndex}`,
      wave: Math.max(1, Math.floor(killIndex / 10) + 1),
      killCount: killIndex,
      playerPartQuantity: input.partQuantity,
      playerPartRarity: input.partRarity,
    });

    if (!drop) {
      continue;
    }

    const part = createPartFromArenaDrop(drop, input.arenaTier, Math.max(1, Math.floor(killIndex / 10) + 1));
    if (parts.length < balanceConfig.offline.dropCap) {
      parts.push(part);
    } else {
      overflowWallet = addWallet(overflowWallet, salvageParts([part]));
    }
  }

  return {
    effectiveSeconds,
    kills,
    parts,
    wallet: addWallet(killWallet(kills), overflowWallet),
    cappedByTime,
  };
}
