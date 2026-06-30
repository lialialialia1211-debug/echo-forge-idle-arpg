import type { TalentNodeDef } from "../engine/topTypes";

export const talentNodes: TalentNodeDef[] = [
  {
    id: "talent_iron_rotation",
    displayName: "Iron Rotation",
    description: "Base stability for longer auto runs.",
    cost: 1,
    statBonuses: { spinIntegrity: 120, guard: 36 },
  },
  {
    id: "talent_razor_geometry",
    displayName: "Razor Geometry",
    description: "Impact and critical pressure.",
    cost: 1,
    requiredNodeIds: ["talent_iron_rotation"],
    statBonuses: { impact: 20, edge: 0.018 },
  },
  {
    id: "talent_live_bearing",
    displayName: "Live Bearing",
    description: "More RPM and stronger pursuit.",
    cost: 1,
    requiredNodeIds: ["talent_iron_rotation"],
    statBonuses: { rpm: 0.34, tracking: 42 },
  },
  {
    id: "talent_furnace_scoring",
    displayName: "Furnace Scoring",
    description: "Heat skills bite harder.",
    cost: 2,
    requiredNodeIds: ["talent_live_bearing"],
    resistanceBonuses: { heat: 0.04 },
    modifiers: [{ id: "talent_furnace_scoring_more", stat: "heat", type: "more", value: 0.12, tags: ["fire"] }],
  },
  {
    id: "talent_storm_lattice",
    displayName: "Storm Lattice",
    description: "Static skills pierce enemy resistance.",
    cost: 2,
    requiredNodeIds: ["talent_live_bearing"],
    resistanceBonuses: { static: 0.04 },
    modifiers: [{ id: "talent_storm_lattice_pen", stat: "static", type: "penetration", value: 0.1, tags: ["lightning"] }],
  },
  {
    id: "talent_salvage_rites",
    displayName: "Salvage Rites",
    description: "More parts and better rarity from clears.",
    cost: 2,
    requiredNodeIds: ["talent_razor_geometry"],
    statBonuses: { partQuantity: 0.12, partRarity: 0.1 },
  },
  {
    id: "talent_last_rotation",
    displayName: "Last Rotation",
    description: "A compact capstone for burst builds.",
    cost: 3,
    requiredNodeIds: ["talent_furnace_scoring", "talent_storm_lattice"],
    statBonuses: { fracture: 0.24, resonance: 0.16 },
    modifiers: [{ id: "talent_last_rotation_damage", stat: "damage", type: "more", value: 0.08 }],
  },
];

export function getTalentNodeDef(talentId: string): TalentNodeDef {
  const talent = talentNodes.find((entry) => entry.id === talentId);
  if (!talent) {
    throw new Error(`Unknown talent node: ${talentId}`);
  }
  return talent;
}
