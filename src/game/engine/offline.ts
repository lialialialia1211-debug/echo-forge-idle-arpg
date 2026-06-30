import type { DefenseSummary, LootSummary, OfflineSummary } from "./types";

export function resolveOffline(
  loot: LootSummary,
  defense: DefenseSummary,
  hoursOffline = 8,
  offlineCap = 12,
  inventoryCap = 300,
): OfflineSummary {
  const effectiveHours = Math.min(hoursOffline, offlineCap);
  const survivalMultiplier = Math.max(0, 1 - defense.deathsPerHour * 0.03);
  const effectiveEfficiency = 0.55 * survivalMultiplier;
  const dropsBeforeCap = loot.itemsPerHour * effectiveHours * effectiveEfficiency;
  const dropsKept = Math.min(dropsBeforeCap, inventoryCap);
  const overflowSalvaged = Math.max(0, dropsBeforeCap - inventoryCap);
  const offlineEv = loot.totalEvPerHour * effectiveHours * effectiveEfficiency * 0.18 + overflowSalvaged * 0.6;

  return {
    effectiveHours,
    effectiveEfficiency,
    dropsBeforeCap,
    dropsKept,
    overflowSalvaged,
    offlineEv,
  };
}
