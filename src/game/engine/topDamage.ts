import { clamp } from "./math";
import type { DamagePacket, DriveCoreDef, TopDamageType, TopModifierDef, TopRuntimeStats } from "./topTypes";
import { emptyDamagePacket } from "./topTypes";

export type TopHitInput = {
  baseDamage: DamagePacket;
  attacker: TopRuntimeStats;
  defender: TopRuntimeStats;
  drive: DriveCoreDef;
  sourceTags: string[];
};

export type TopHitResult = {
  rawDamage: DamagePacket;
  mitigatedDamage: DamagePacket;
  totalDamage: number;
  hitChance: number;
  critChance: number;
  expectedCritMultiplier: number;
};

function modifierApplies(modifier: TopModifierDef, tags: string[]): boolean {
  if (!modifier.tags || modifier.tags.length === 0) {
    return true;
  }
  return modifier.tags.some((tag) => tags.includes(tag));
}

function getModifiers(attacker: TopRuntimeStats, drive: DriveCoreDef, tags: string[]): TopModifierDef[] {
  return [...attacker.modifiers, ...drive.modifiers].filter((modifier) => modifierApplies(modifier, tags));
}

function statModifierValue(modifiers: TopModifierDef[], stat: string, type: TopModifierDef["type"]): number {
  return modifiers
    .filter((modifier) => modifier.stat === stat && modifier.type === type)
    .reduce((total, modifier) => total + modifier.value, 0);
}

function productModifier(modifiers: TopModifierDef[], stat: string, type: "more" | "less"): number {
  return modifiers
    .filter((modifier) => modifier.stat === stat && modifier.type === type)
    .reduce((total, modifier) => total * (type === "more" ? 1 + modifier.value : 1 - modifier.value), 1);
}

function applyExtraAs(packet: DamagePacket, modifiers: TopModifierDef[]): DamagePacket {
  const next = { ...packet };

  for (const modifier of modifiers) {
    if (modifier.type !== "extraAs" || !modifier.fromDamageType || !modifier.toDamageType) {
      continue;
    }
    next[modifier.toDamageType] += packet[modifier.fromDamageType] * modifier.value;
  }

  return next;
}

function applyConversion(packet: DamagePacket, modifiers: TopModifierDef[]): DamagePacket {
  const next = { ...packet };
  const bySource = new Map<TopDamageType, TopModifierDef[]>();

  for (const modifier of modifiers) {
    if (modifier.type !== "conversion" || !modifier.fromDamageType || !modifier.toDamageType) {
      continue;
    }
    bySource.set(modifier.fromDamageType, [...(bySource.get(modifier.fromDamageType) ?? []), modifier]);
  }

  for (const [source, sourceModifiers] of bySource.entries()) {
    const totalConversion = sourceModifiers.reduce((sum, modifier) => sum + modifier.value, 0);
    const scalar = totalConversion > 1 ? 1 / totalConversion : 1;

    for (const modifier of sourceModifiers) {
      const converted = packet[source] * modifier.value * scalar;
      next[source] -= converted;
      next[modifier.toDamageType!] += converted;
    }
  }

  return next;
}

function scaleDamageType(type: TopDamageType, value: number, modifiers: TopModifierDef[]): number {
  const flat = statModifierValue(modifiers, type, "flat");
  const increased = statModifierValue(modifiers, type, "increased") + statModifierValue(modifiers, "damage", "increased");
  const reduced = statModifierValue(modifiers, type, "reduced") + statModifierValue(modifiers, "damage", "reduced");
  const more = productModifier(modifiers, type, "more") * productModifier(modifiers, "damage", "more");
  const less = productModifier(modifiers, type, "less") * productModifier(modifiers, "damage", "less");

  return Math.max(0, (value + flat) * (1 + increased - reduced) * more * less);
}

function mitigateDamageType(type: TopDamageType, value: number, defender: TopRuntimeStats, modifiers: TopModifierDef[]): number {
  if (type === "impact") {
    const guardReduction = defender.guard / (defender.guard + 10 * Math.max(1, value));
    return value * (1 - clamp(guardReduction, 0, 0.9));
  }

  const penetration = statModifierValue(modifiers, type, "penetration");
  const resistance = clamp((defender.resistances[type] ?? 0) - penetration, -0.75, 0.9);
  return value * (1 - resistance);
}

export function resolveTopHit({ baseDamage, attacker, defender, drive, sourceTags }: TopHitInput): TopHitResult {
  const tags = [...drive.tags, ...sourceTags];
  const modifiers = getModifiers(attacker, drive, tags);
  const converted = applyConversion(baseDamage, modifiers);
  const withExtra = applyExtraAs(converted, modifiers);
  const rawDamage = emptyDamagePacket();
  const mitigatedDamage = emptyDamagePacket();
  const hitChance = clamp(attacker.tracking / (attacker.tracking + defender.drift * 0.85), 0.05, 0.95);
  const edge = statModifierValue(modifiers, "edge", "flat");
  const critChance = clamp(attacker.edge + edge, 0, 0.85);
  const expectedCritMultiplier = 1 + critChance * (attacker.fracture - 1);

  for (const type of Object.keys(rawDamage) as TopDamageType[]) {
    rawDamage[type] = scaleDamageType(type, withExtra[type], modifiers);
    mitigatedDamage[type] = mitigateDamageType(type, rawDamage[type], defender, modifiers) * hitChance * expectedCritMultiplier;
  }

  return {
    rawDamage,
    mitigatedDamage,
    totalDamage: Object.values(mitigatedDamage).reduce((sum, value) => sum + value, 0),
    hitChance,
    critChance,
    expectedCritMultiplier,
  };
}
