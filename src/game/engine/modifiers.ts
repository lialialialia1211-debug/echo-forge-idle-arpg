import type { LevelCurve, ModifierDef, SkillTag, StatBlock, StatId } from "./types";
import { clamp } from "./math";

export function levelCurveValue(curve: LevelCurve, level: number): number {
  const growth = curve.growth ?? 1;
  return curve.base + curve.perLevel * (level - 1) * growth ** Math.max(0, level - 1);
}

export function modifierMatchesTags(modifier: ModifierDef, tags: SkillTag[] = []): boolean {
  if (!modifier.tags || modifier.tags.length === 0) {
    return true;
  }

  return modifier.tags.some((tag) => tags.includes(tag));
}

export function resolveStat(
  base: number,
  modifiers: ModifierDef[],
  stat: StatId,
  tags: SkillTag[] = [],
): number {
  let flat = 0;
  let increased = 0;
  let reduced = 0;
  let more = 1;
  let less = 1;
  let cap: number | null = null;

  for (const modifier of modifiers) {
    if (modifier.stat !== stat || !modifierMatchesTags(modifier, tags)) {
      continue;
    }

    if (modifier.type === "flat") {
      flat += modifier.value;
    } else if (modifier.type === "increased") {
      increased += modifier.value;
    } else if (modifier.type === "reduced") {
      reduced += modifier.value;
    } else if (modifier.type === "more") {
      more *= 1 + modifier.value;
    } else if (modifier.type === "less") {
      less *= 1 - modifier.value;
    } else if (modifier.type === "cap") {
      cap = cap === null ? modifier.value : Math.min(cap, modifier.value);
    }
  }

  let value = (base + flat) * Math.max(0, 1 + increased - reduced) * more * less;
  if (cap !== null) {
    value = Math.min(value, cap);
  }

  return value;
}

export function sumSpecialModifiers(
  modifiers: ModifierDef[],
  stat: StatId,
  type: "penetration" | "extraAs",
  tags: SkillTag[] = [],
): number {
  return modifiers
    .filter((modifier) => modifier.stat === stat && modifier.type === type && modifierMatchesTags(modifier, tags))
    .reduce((sum, modifier) => sum + modifier.value, 0);
}

export function mergeStatBlocks(...blocks: StatBlock[]): StatBlock {
  const merged: StatBlock = {};

  for (const block of blocks) {
    for (const [key, value] of Object.entries(block) as [StatId, number][]) {
      merged[key] = (merged[key] ?? 0) + value;
    }
  }

  return merged;
}

export function hitChanceFromRatings(accuracy: number, evasion: number): number {
  return clamp(accuracy / (accuracy + Math.pow(evasion / 4, 0.8)), 0.05, 0.95);
}
