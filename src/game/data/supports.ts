import type { SupportDef } from "../engine/types";

export const supports: SupportDef[] = [
  {
    id: "support_focused_force",
    displayName: "Focused Force",
    requiredTags: [],
    modifiers: [
      { id: "focused_force_more", stat: "damage", type: "more", value: 0.24, source: "support" },
      { id: "focused_force_slow", stat: "actionSpeed", type: "less", value: 0.08, source: "support" },
    ],
    costMultiplier: 1.18,
  },
  {
    id: "support_swift_rhythm",
    displayName: "Swift Rhythm",
    requiredTags: ["attack"],
    modifiers: [
      { id: "swift_rhythm_speed", stat: "actionSpeed", type: "more", value: 0.22, source: "support" },
      { id: "swift_rhythm_damage", stat: "damage", type: "reduced", value: 0.06, source: "support" },
    ],
    costMultiplier: 1.12,
  },
  {
    id: "support_echoing_circuit",
    displayName: "Echoing Circuit",
    requiredTags: ["spell"],
    modifiers: [
      { id: "echoing_circuit_more", stat: "damage", type: "more", value: 0.18, source: "support" },
      { id: "echoing_circuit_speed", stat: "actionSpeed", type: "more", value: 0.1, source: "support" },
    ],
    costMultiplier: 1.22,
  },
  {
    id: "support_piercing_arc",
    displayName: "Piercing Arc",
    requiredTags: ["projectile"],
    modifiers: [
      { id: "piercing_arc_damage", stat: "damage", type: "increased", value: 0.38, source: "support" },
      { id: "piercing_arc_quantity", stat: "itemQuantity", type: "flat", value: 0.03, source: "support" },
    ],
    costMultiplier: 1.08,
  },
  {
    id: "support_cruel_edge",
    displayName: "Cruel Edge",
    requiredTags: ["critical"],
    modifiers: [
      { id: "cruel_edge_chance", stat: "critChance", type: "increased", value: 0.85, source: "support" },
      { id: "cruel_edge_multiplier", stat: "critMultiplier", type: "flat", value: 0.28, source: "support" },
    ],
    costMultiplier: 1.16,
  },
  {
    id: "support_cinder_mark",
    displayName: "Cinder Mark",
    requiredTags: ["fire"],
    modifiers: [
      { id: "cinder_mark_pen", stat: "penetration", type: "penetration", value: 0.12, source: "support" },
      { id: "cinder_mark_damage", stat: "damage", type: "increased", value: 0.24, source: "support" },
    ],
    costMultiplier: 1.15,
  },
  {
    id: "support_platebreaker",
    displayName: "Platebreaker",
    requiredTags: ["physical"],
    modifiers: [
      { id: "platebreaker_pen", stat: "penetration", type: "penetration", value: 0.08, source: "support" },
      { id: "platebreaker_more", stat: "damage", type: "more", value: 0.12, source: "support" },
    ],
    costMultiplier: 1.1,
  },
  {
    id: "support_wide_fracture",
    displayName: "Wide Fracture",
    requiredTags: ["area"],
    modifiers: [
      { id: "wide_fracture_damage", stat: "damage", type: "less", value: 0.08, source: "support" },
      { id: "wide_fracture_quantity", stat: "itemQuantity", type: "flat", value: 0.08, source: "support" },
    ],
    costMultiplier: 1.05,
  },
  {
    id: "support_vault_hunger",
    displayName: "Vault Hunger",
    requiredTags: [],
    modifiers: [
      { id: "vault_hunger_rarity", stat: "itemRarity", type: "flat", value: 0.18, source: "support" },
      { id: "vault_hunger_less", stat: "damage", type: "less", value: 0.1, source: "support" },
    ],
    costMultiplier: 1,
  },
  {
    id: "support_lifebound",
    displayName: "Lifebound",
    requiredTags: ["melee"],
    modifiers: [
      { id: "lifebound_damage", stat: "damage", type: "increased", value: 0.18, source: "support" },
      { id: "lifebound_recovery", stat: "recoveryPerSecond", type: "flat", value: 30, source: "support" },
    ],
    costMultiplier: 1.08,
  },
  {
    id: "support_null_wake",
    displayName: "Null Wake",
    requiredTags: ["void"],
    modifiers: [
      { id: "null_wake_extra", stat: "extraAsDamage", type: "extraAs", value: 0.16, source: "support" },
      { id: "null_wake_shield", stat: "shield", type: "flat", value: 110, source: "support" },
    ],
    costMultiplier: 1.2,
  },
  {
    id: "support_commanding_rite",
    displayName: "Commanding Rite",
    requiredTags: ["minion"],
    modifiers: [
      { id: "commanding_rite_more", stat: "damage", type: "more", value: 0.3, source: "support" },
      { id: "commanding_rite_speed", stat: "actionSpeed", type: "less", value: 0.12, source: "support" },
    ],
    costMultiplier: 1.24,
  },
];

export function isSupportCompatible(support: SupportDef, skillTags: string[]): boolean {
  const hasRequiredTags = support.requiredTags.every((tag) => skillTags.includes(tag));
  const hasExcludedTag = support.excludedTags?.some((tag) => skillTags.includes(tag)) ?? false;
  return hasRequiredTags && !hasExcludedTag;
}

export function getSupportDef(supportId: string): SupportDef {
  const support = supports.find((entry) => entry.id === supportId);
  if (!support) {
    throw new Error(`Unknown support: ${supportId}`);
  }
  return support;
}
