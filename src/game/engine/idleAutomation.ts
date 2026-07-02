import { getTopPartBaseDef } from "../data/topPartBases";
import { accountReducer, inventoryCapacity } from "./accountReducer";
import type { AccountRuntimeState } from "./accountState";
import type { TopPartInstance, TopPartRarity, TopPartSlotId } from "./topTypes";

export type IdleAutomationRule = {
  enabled: boolean;
  autoEquipBetter: boolean;
  salvageBelowRarity: TopPartRarity;
  preferredSlots?: TopPartSlotId[];
};

export type IdleAutomationResult = {
  state: AccountRuntimeState;
  equippedPartIds: string[];
  keptPartIds: string[];
  salvagedPartIds: string[];
};

const rarityScore: Record<TopPartRarity, number> = {
  common: 0,
  tuned: 1,
  engraved: 2,
  relic: 3,
};

export const defaultIdleAutomationRule: IdleAutomationRule = {
  enabled: true,
  autoEquipBetter: true,
  salvageBelowRarity: "common",
};

export function scoreTopPart(part: TopPartInstance): number {
  const base = getTopPartBaseDef(part.baseId);
  const statScore = Object.values(part.statBonuses).reduce((sum, value) => sum + Math.max(0, value ?? 0), 0);
  const resistanceScore = Object.values(part.resistanceBonuses).reduce((sum, value) => sum + Math.max(0, value ?? 0) * 140, 0);
  const modifierScore = part.modifiers.length * 24 + (part.affixes ?? []).length * 18;
  const uniqueScore = base.uniqueEffect ? 70 : 0;
  return rarityScore[part.rarity] * 90 + statScore + resistanceScore + modifierScore + uniqueScore;
}

export function applyIdleAutomation(state: AccountRuntimeState, drops: TopPartInstance[], rule: IdleAutomationRule = defaultIdleAutomationRule): IdleAutomationResult {
  if (!rule.enabled) {
    const nextState = accountReducer(state, { type: "ingestDrops", parts: drops, capacity: inventoryCapacity });
    return {
      state: nextState,
      equippedPartIds: [],
      keptPartIds: drops.map((part) => part.id),
      salvagedPartIds: [],
    };
  }

  let nextState = state;
  const equippedPartIds: string[] = [];
  const keptPartIds: string[] = [];
  const salvagedPartIds: string[] = [];
  const minRarityScore = rarityScore[rule.salvageBelowRarity];

  for (const drop of drops) {
    const slotAllowed = !rule.preferredSlots || rule.preferredSlots.includes(drop.slot);
    const equipped = nextState.equipment[drop.slot];
    const betterThanEquipped = slotAllowed && (!equipped || scoreTopPart(drop) > scoreTopPart(equipped));

    if (rule.autoEquipBetter && betterThanEquipped) {
      nextState = accountReducer(accountReducer(nextState, { type: "ingestDrops", parts: [drop], capacity: inventoryCapacity }), { type: "equipPart", part: drop });
      equippedPartIds.push(drop.id);
      continue;
    }

    if (rarityScore[drop.rarity] < minRarityScore) {
      const withDrop = accountReducer(nextState, { type: "ingestDrops", parts: [drop], capacity: inventoryCapacity });
      nextState = accountReducer(withDrop, { type: "salvagePart", partId: drop.id });
      salvagedPartIds.push(drop.id);
      continue;
    }

    nextState = accountReducer(nextState, { type: "ingestDrops", parts: [drop], capacity: inventoryCapacity });
    keptPartIds.push(drop.id);
  }

  return { state: nextState, equippedPartIds, keptPartIds, salvagedPartIds };
}
