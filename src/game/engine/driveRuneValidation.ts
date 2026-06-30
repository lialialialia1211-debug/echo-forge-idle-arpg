import { getDriveCoreDef } from "../data/driveCores";
import { getTuningRuneDef, isRuneCompatible } from "../data/tuningRunes";
import type { TuningRuneDef } from "./topTypes";

export type RuneValidationIssue = {
  runeId: string;
  reason: "unknown" | "incompatible" | "duplicate" | "family_duplicate";
  message: string;
};

export type RuneLoadoutValidation = {
  validRuneIds: string[];
  issues: RuneValidationIssue[];
  costMultiplier: number;
  instability: number;
};

function validateRuneFamily(rune: TuningRuneDef, activeFamilies: Set<string>): RuneValidationIssue | null {
  if (!rune.supportFamily) {
    return null;
  }
  if (!activeFamilies.has(rune.supportFamily)) {
    activeFamilies.add(rune.supportFamily);
    return null;
  }

  return {
    runeId: rune.id,
    reason: "family_duplicate",
    message: `${rune.displayName} duplicates support family ${rune.supportFamily}`,
  };
}

export function validateRuneLoadout(driveId: string, runeIds: string[]): RuneLoadoutValidation {
  const drive = getDriveCoreDef(driveId);
  const seen = new Set<string>();
  const activeFamilies = new Set<string>();
  const validRuneIds: string[] = [];
  const issues: RuneValidationIssue[] = [];
  let costMultiplier = 1;
  let instability = 0;

  for (const runeId of runeIds) {
    if (seen.has(runeId)) {
      issues.push({
        runeId,
        reason: "duplicate",
        message: `${runeId} is already linked`,
      });
      continue;
    }
    seen.add(runeId);

    let rune: TuningRuneDef;
    try {
      rune = getTuningRuneDef(runeId);
    } catch {
      issues.push({
        runeId,
        reason: "unknown",
        message: `${runeId} is not a known tuning rune`,
      });
      continue;
    }

    if (!isRuneCompatible(rune, drive.tags)) {
      issues.push({
        runeId,
        reason: "incompatible",
        message: `${rune.displayName} does not support ${drive.displayName}`,
      });
      continue;
    }

    const familyIssue = validateRuneFamily(rune, activeFamilies);
    if (familyIssue) {
      issues.push(familyIssue);
      continue;
    }

    validRuneIds.push(runeId);
    costMultiplier *= rune.costMultiplier ?? 1;
    instability += rune.instability ?? 0;
  }

  return {
    validRuneIds,
    issues,
    costMultiplier: Math.round(costMultiplier * 1000) / 1000,
    instability: Math.round(instability * 1000) / 1000,
  };
}
