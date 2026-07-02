import type { TopFrameDef } from "../engine/topTypes";

export const topFrames: TopFrameDef[] = [
  {
    id: "frame_swift_razor",
    displayName: "Swift Razor",
    role: "High RPM impact striker",
    fantasy: "A black steel blade top that wins by fast cuts, crits, and constant contact.",
    baseStats: {
      maxSpinIntegrity: 980,
      maxFluxGuard: 120,
      guard: 210,
      drift: 680,
      tracking: 720,
      impact: 118,
      rpm: 7.2,
      mass: 0.78,
      grip: 0.42,
      edge: 0.11,
      fracture: 1.78,
      resonance: 0.92,
    },
    preferredTags: ["attack", "projectile", "physical", "critical", "speed"],
    startingDriveId: "drive_shard_barrage",
  },
  {
    id: "frame_ember_crucible",
    displayName: "Ember Crucible",
    role: "Heat trail arena control",
    fantasy: "A furnace-hearted top that scores the arena with molten grooves.",
    baseStats: {
      maxSpinIntegrity: 1120,
      maxFluxGuard: 260,
      guard: 260,
      drift: 420,
      tracking: 560,
      impact: 96,
      rpm: 5.9,
      mass: 2.05,
      grip: 0.62,
      edge: 0.07,
      fracture: 1.58,
      resonance: 1.24,
    },
    preferredTags: ["spell", "fire", "area", "duration"],
    startingDriveId: "drive_ember_scour",
  },
  {
    id: "frame_storm_needle",
    displayName: "Storm Needle",
    role: "Static chain trigger top",
    fantasy: "A needle-balanced spinner that lashes the arena with white-blue arcs.",
    baseStats: {
      maxSpinIntegrity: 900,
      maxFluxGuard: 220,
      guard: 170,
      drift: 620,
      tracking: 800,
      impact: 88,
      rpm: 7.8,
      mass: 0.62,
      grip: 0.38,
      edge: 0.09,
      fracture: 1.66,
      resonance: 1.18,
    },
    preferredTags: ["spell", "lightning", "chain", "speed"],
    startingDriveId: "drive_storm_lattice",
  },
];

export function getTopFrameDef(frameId: string): TopFrameDef {
  const frame = topFrames.find((entry) => entry.id === frameId);
  if (!frame) {
    throw new Error(`Unknown top frame: ${frameId}`);
  }
  return frame;
}
