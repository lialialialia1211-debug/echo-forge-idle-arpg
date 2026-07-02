import { balanceConfig } from "./balanceConfig";
import type { DriveCoreDef } from "../engine/topTypes";

export const driveCores: DriveCoreDef[] = [
  {
    id: "drive_shard_barrage",
    displayName: "Shard Barrage",
    tags: ["attack", "projectile", "physical", "critical"],
    damageTypes: ["impact"],
    trigger: "onCooldown",
    baseCooldown: 0.85,
    baseDamage: { impact: 72, heat: 0, glass: 0, static: 0, void: 0 },
    cost: { amount: 16 },
    cooldown: { baseSeconds: 0.85, recoveryStat: "cooldownRecovery" },
    hit: {
      source: "drive",
      damage: { impact: 72, heat: 0, glass: 0, static: 0, void: 0 },
      usesTracking: true,
      canCrit: true,
    },
    scaling: [{ stat: "impact", coefficient: 0.42, tags: ["projectile"] }],
    modifiers: [
      { id: "shard_more_projectile_impact", stat: "impact", type: "more", value: 0.18, tags: ["projectile"] },
      { id: "shard_added_edge", stat: "edge", type: "flat", value: 0.03, tags: ["critical"] },
    ],
    visual: "sparks",
  },
  {
    id: "drive_razor_rebound",
    displayName: "Razor Rebound",
    tags: ["attack", "melee", "physical", "speed", "critical"],
    damageTypes: ["impact"],
    trigger: "onCollision",
    baseCooldown: 0.58,
    baseDamage: { impact: 54, heat: 0, glass: 0, static: 0, void: 0 },
    requiredAttributes: [{ kind: "attr", attr: "mass", op: ">=", value: balanceConfig.thresholds.specializedDriveAttribute }],
    cost: { amount: 12 },
    cooldown: { baseSeconds: 0.58, recoveryStat: "cooldownRecovery" },
    hit: {
      source: "collision",
      damage: { impact: 54, heat: 0, glass: 0, static: 0, void: 0 },
      usesTracking: false,
      canCrit: true,
    },
    scaling: [
      { stat: "rpm", coefficient: 7.5, tags: ["speed"] },
      { stat: "impact", coefficient: 0.28, tags: ["melee"] },
    ],
    modifiers: [
      { id: "rebound_more_melee", stat: "impact", type: "more", value: 0.14, tags: ["melee"] },
      { id: "rebound_smash_mass_more", stat: "impact", type: "more", value: 0.3, tags: ["melee"], condition: { kind: "event", event: "smash" } },
      { id: "rebound_edge", stat: "edge", type: "flat", value: 0.025, tags: ["critical"] },
    ],
    visual: "sparks",
  },
  {
    id: "drive_ember_scour",
    displayName: "Ember Scour",
    tags: ["spell", "fire", "area", "duration"],
    damageTypes: ["heat"],
    trigger: "onCooldown",
    baseCooldown: 1.25,
    baseDamage: { impact: 0, heat: 92, glass: 0, static: 0, void: 0 },
    cost: { amount: 22 },
    cooldown: { baseSeconds: 1.25, recoveryStat: "cooldownRecovery" },
    hit: {
      source: "drive",
      damage: { impact: 0, heat: 58, glass: 0, static: 0, void: 0 },
      usesTracking: true,
      canCrit: false,
    },
    dot: {
      source: "trail",
      damageType: "heat",
      baseDps: 42,
      duration: 2.4,
    },
    arenaEffect: {
      damageType: "heat",
      baseDps: 30,
      radius: 64,
      duration: 2.4,
    },
    scaling: [{ stat: "resonance", coefficient: 34, tags: ["fire", "duration"] }],
    modifiers: [
      { id: "ember_more_heat", stat: "heat", type: "more", value: 0.22, tags: ["fire"] },
      { id: "ember_heat_as_extra_impact", stat: "heat", type: "extraAs", value: 0.12, fromDamageType: "impact", toDamageType: "heat" },
    ],
    visual: "emberTrail",
  },
  {
    id: "drive_molten_groove",
    displayName: "Molten Groove",
    tags: ["spell", "fire", "area", "duration", "control"],
    damageTypes: ["heat"],
    trigger: "onEnemyEnterRadius",
    baseCooldown: 1.55,
    baseDamage: { impact: 0, heat: 66, glass: 0, static: 0, void: 0 },
    cost: { amount: 28 },
    cooldown: { baseSeconds: 1.55, recoveryStat: "cooldownRecovery" },
    hit: {
      source: "hazard",
      damage: { impact: 0, heat: 66, glass: 0, static: 0, void: 0 },
      usesTracking: true,
      canCrit: false,
    },
    dot: {
      source: "hazard",
      damageType: "heat",
      baseDps: 58,
      duration: 3.2,
    },
    arenaEffect: {
      damageType: "heat",
      baseDps: 42,
      radius: 92,
      duration: 3.2,
    },
    scaling: [
      { stat: "resonance", coefficient: 46, tags: ["fire", "duration"] },
      { stat: "grip", coefficient: 120, tags: ["control"] },
    ],
    modifiers: [
      { id: "groove_more_area_heat", stat: "heat", type: "more", value: 0.18, tags: ["area"] },
      { id: "groove_guard", stat: "guard", type: "flat", value: 34, tags: ["control"] },
    ],
    visual: "emberTrail",
  },
  {
    id: "drive_storm_lattice",
    displayName: "Storm Lattice",
    tags: ["spell", "lightning", "chain"],
    damageTypes: ["static"],
    trigger: "onCooldown",
    baseCooldown: 1.05,
    baseDamage: { impact: 0, heat: 0, glass: 0, static: 78, void: 0 },
    requiredAttributes: [{ kind: "attr", attr: "omega", op: ">=", value: balanceConfig.thresholds.specializedDriveAttribute }],
    cost: { amount: 20 },
    cooldown: { baseSeconds: 1.05, recoveryStat: "cooldownRecovery" },
    hit: {
      source: "drive",
      damage: { impact: 0, heat: 0, glass: 0, static: 78, void: 0 },
      usesTracking: true,
      canCrit: true,
    },
    scaling: [{ stat: "rpm", coefficient: 6.5, tags: ["lightning", "chain"] }],
    modifiers: [
      { id: "storm_more_static", stat: "static", type: "more", value: 0.16, tags: ["lightning"] },
      { id: "storm_static_pen", stat: "static", type: "penetration", value: 0.12, tags: ["lightning"] },
    ],
    visual: "stormArc",
  },
  {
    id: "drive_chain_tempest",
    displayName: "Chain Tempest",
    tags: ["spell", "lightning", "chain", "area", "risk"],
    damageTypes: ["static"],
    trigger: "onCooldown",
    baseCooldown: 1.35,
    baseDamage: { impact: 0, heat: 0, glass: 0, static: 104, void: 0 },
    requiredAttributes: [
      {
        kind: "attr",
        attr: "maxFlux",
        op: ">=",
        value: balanceConfig.flux.baseMax + balanceConfig.thresholds.specializedDriveAttribute * balanceConfig.flux.maxPerResonance,
      },
    ],
    cost: { amount: 30 },
    cooldown: { baseSeconds: 1.35, recoveryStat: "cooldownRecovery" },
    hit: {
      source: "drive",
      damage: { impact: 0, heat: 0, glass: 0, static: 104, void: 0 },
      usesTracking: true,
      canCrit: true,
    },
    scaling: [
      { stat: "tracking", coefficient: 0.14, tags: ["chain"] },
      { stat: "rpm", coefficient: 8, tags: ["lightning"] },
    ],
    modifiers: [
      { id: "tempest_more_chain", stat: "static", type: "more", value: 0.2, tags: ["chain"] },
      { id: "tempest_instability_damage", stat: "damage", type: "increased", value: 0.14, tags: ["risk"] },
    ],
    visual: "stormArc",
  },
];

export function getDriveCoreDef(driveId: string): DriveCoreDef {
  const drive = driveCores.find((entry) => entry.id === driveId);
  if (!drive) {
    throw new Error(`Unknown drive core: ${driveId}`);
  }
  return drive;
}
