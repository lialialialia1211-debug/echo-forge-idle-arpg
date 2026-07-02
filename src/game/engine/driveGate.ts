import { attrValueForCondition, evaluateCombatCondition, type CombatContext } from "./conditionEval";
import type { DriveAttributeRequirement, DriveCoreDef } from "./topTypes";

export type DriveGateMissingRequirement = DriveAttributeRequirement & {
  currentValue: number;
};

export type DriveGateStatus = {
  unlocked: boolean;
  requirements: DriveAttributeRequirement[];
  missing: DriveGateMissingRequirement[];
};

export function evaluateDriveGate(drive: DriveCoreDef, context: CombatContext): DriveGateStatus {
  const requirements = drive.requiredAttributes ?? [];
  const missing = requirements
    .filter((requirement) => !evaluateCombatCondition(requirement, context))
    .map((requirement) => ({
      ...requirement,
      currentValue: attrValueForCondition(context, requirement.attr),
    }));

  return {
    unlocked: missing.length === 0,
    requirements,
    missing,
  };
}
