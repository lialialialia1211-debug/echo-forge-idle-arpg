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
    modifiers: [
      { id: "shard_more_projectile_impact", stat: "impact", type: "more", value: 0.18, tags: ["projectile"] },
      { id: "shard_added_edge", stat: "edge", type: "flat", value: 0.03, tags: ["critical"] },
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
    modifiers: [
      { id: "ember_more_heat", stat: "heat", type: "more", value: 0.22, tags: ["fire"] },
      { id: "ember_heat_as_extra_impact", stat: "heat", type: "extraAs", value: 0.12, fromDamageType: "impact", toDamageType: "heat" },
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
    modifiers: [
      { id: "storm_more_static", stat: "static", type: "more", value: 0.16, tags: ["lightning"] },
      { id: "storm_static_pen", stat: "static", type: "penetration", value: 0.12, tags: ["lightning"] },
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
