import type { TalentNodeDef, TopModifierDef, TopResistanceBlock, TopStatBlock } from "../engine/topTypes";

type TalentClusterSpec = {
  clusterId: string;
  label: string;
  anchor: { x: number; y: number };
  requiredNodeId: string;
  statA: TopStatBlock;
  statB: TopStatBlock;
  resistance?: TopResistanceBlock;
  notable: {
    label: string;
    description: string;
    statBonuses?: TopStatBlock;
    resistanceBonuses?: TopResistanceBlock;
    modifiers?: TopModifierDef[];
  };
};

const coreTalentNodes: TalentNodeDef[] = [
  {
    id: "talent_iron_rotation",
    displayName: "Iron Rotation",
    description: "Base stability for longer auto runs.",
    cost: 1,
    position: { x: 50, y: 52 },
    kind: "minor",
    clusterId: "core",
    statBonuses: { spinIntegrity: 120, guard: 36 },
  },
  {
    id: "talent_razor_geometry",
    displayName: "Razor Geometry",
    description: "Impact and critical pressure.",
    cost: 1,
    position: { x: 30, y: 39 },
    kind: "minor",
    clusterId: "core",
    requiredNodeIds: ["talent_iron_rotation"],
    statBonuses: { impact: 20, edge: 0.018 },
  },
  {
    id: "talent_live_bearing",
    displayName: "Live Bearing",
    description: "More RPM and stronger pursuit.",
    cost: 1,
    position: { x: 70, y: 39 },
    kind: "minor",
    clusterId: "core",
    requiredNodeIds: ["talent_iron_rotation"],
    statBonuses: { rpm: 0.34, tracking: 42 },
  },
  {
    id: "talent_furnace_scoring",
    displayName: "Furnace Scoring",
    description: "Heat skills bite harder.",
    cost: 2,
    position: { x: 68, y: 16 },
    kind: "notable",
    clusterId: "fire",
    requiredNodeIds: ["talent_live_bearing"],
    resistanceBonuses: { heat: 0.04 },
    modifiers: [{ id: "talent_furnace_scoring_more", stat: "heat", type: "more", value: 0.12, tags: ["fire"] }],
  },
  {
    id: "talent_storm_lattice",
    displayName: "Storm Lattice",
    description: "Static skills pierce enemy resistance.",
    cost: 2,
    position: { x: 82, y: 59 },
    kind: "notable",
    clusterId: "static",
    requiredNodeIds: ["talent_live_bearing"],
    resistanceBonuses: { static: 0.04 },
    modifiers: [{ id: "talent_storm_lattice_pen", stat: "static", type: "penetration", value: 0.1, tags: ["lightning"] }],
  },
  {
    id: "talent_salvage_rites",
    displayName: "Salvage Rites",
    description: "More parts and better rarity from clears.",
    cost: 2,
    position: { x: 18, y: 59 },
    kind: "notable",
    clusterId: "loot",
    requiredNodeIds: ["talent_razor_geometry"],
    statBonuses: { partQuantity: 0.12, partRarity: 0.1 },
    modifiers: [{ id: "talent_salvage_rites_risk", stat: "damage", type: "increased", value: 0.06, tags: ["risk"] }],
  },
  {
    id: "talent_last_rotation",
    displayName: "Last Rotation",
    description: "A compact capstone for burst builds.",
    cost: 3,
    position: { x: 50, y: 11 },
    kind: "notable",
    clusterId: "core",
    requiredNodeIds: ["talent_furnace_scoring", "talent_storm_lattice"],
    statBonuses: { fracture: 0.24, resonance: 0.16 },
    modifiers: [{ id: "talent_last_rotation_damage", stat: "damage", type: "more", value: 0.08 }],
  },
];

const clusterSpecs: TalentClusterSpec[] = [
  {
    clusterId: "impact",
    label: "Impact",
    anchor: { x: 22, y: 28 },
    requiredNodeId: "talent_razor_geometry",
    statA: { impact: 12 },
    statB: { stagger: 0.08 },
    notable: {
      label: "Brass Teeth",
      description: "Heavy contact converts more cleanly into integrity damage.",
      statBonuses: { impact: 32, stagger: 0.16 },
      modifiers: [{ id: "talent_impact_brass_teeth", stat: "impact", type: "more", value: 0.07, tags: ["melee"] }],
    },
  },
  {
    clusterId: "guard",
    label: "Guard",
    anchor: { x: 39, y: 72 },
    requiredNodeId: "talent_iron_rotation",
    statA: { guard: 24 },
    statB: { spinIntegrity: 70 },
    notable: {
      label: "Anvil Halo",
      description: "Guard-heavy builds bleed less momentum from clashes.",
      statBonuses: { guard: 62, spinIntegrity: 120 },
      modifiers: [{ id: "talent_guard_anvil_halo", stat: "damage", type: "less", value: 0.05, tags: ["thorns"] }],
    },
  },
  {
    clusterId: "speed",
    label: "Speed",
    anchor: { x: 78, y: 29 },
    requiredNodeId: "talent_live_bearing",
    statA: { rpm: 0.18 },
    statB: { tracking: 24 },
    notable: {
      label: "Redline Bearings",
      description: "Fast drives recover into their next trigger sooner.",
      statBonuses: { rpm: 0.42, cooldownRecovery: 0.08 },
      modifiers: [{ id: "talent_speed_redline", stat: "damage", type: "more", value: 0.05, tags: ["speed"] }],
    },
  },
  {
    clusterId: "fire",
    label: "Furnace",
    anchor: { x: 66, y: 8 },
    requiredNodeId: "talent_furnace_scoring",
    statA: { resonance: 0.05 },
    statB: { partRarity: 0.025 },
    resistance: { heat: 0.025 },
    notable: {
      label: "Molten Groove",
      description: "Heat trails linger as stronger burn pressure.",
      resistanceBonuses: { heat: 0.05 },
      modifiers: [{ id: "talent_fire_molten_groove", stat: "heat", type: "more", value: 0.09, tags: ["duration"] }],
    },
  },
  {
    clusterId: "static",
    label: "Static",
    anchor: { x: 90, y: 50 },
    requiredNodeId: "talent_storm_lattice",
    statA: { tracking: 28 },
    statB: { edge: 0.012 },
    resistance: { static: 0.025 },
    notable: {
      label: "Arc Winding",
      description: "Shock and chain builds gain tighter targeting.",
      statBonuses: { tracking: 68 },
      modifiers: [{ id: "talent_static_arc_winding", stat: "static", type: "penetration", value: 0.08, tags: ["chain"] }],
    },
  },
  {
    clusterId: "glass",
    label: "Glass",
    anchor: { x: 14, y: 44 },
    requiredNodeId: "talent_razor_geometry",
    statA: { edge: 0.01 },
    statB: { fracture: 0.035 },
    resistance: { glass: 0.02 },
    notable: {
      label: "Splinter Line",
      description: "Critical shards turn precision into bleed pressure.",
      statBonuses: { edge: 0.035, fracture: 0.08 },
      modifiers: [{ id: "talent_glass_splinter_line", stat: "glass", type: "more", value: 0.08, tags: ["critical"] }],
    },
  },
  {
    clusterId: "void",
    label: "Void",
    anchor: { x: 72, y: 75 },
    requiredNodeId: "talent_live_bearing",
    statA: { resonance: 0.045 },
    statB: { grip: 0.04 },
    resistance: { void: 0.025 },
    notable: {
      label: "Null Basin",
      description: "Void hits drag enemy motion into a slower orbit.",
      statBonuses: { resonance: 0.12, grip: 0.1 },
      modifiers: [{ id: "talent_void_null_basin", stat: "void", type: "more", value: 0.09, tags: ["void"] }],
    },
  },
  {
    clusterId: "loot",
    label: "Forge",
    anchor: { x: 12, y: 78 },
    requiredNodeId: "talent_salvage_rites",
    statA: { partQuantity: 0.025 },
    statB: { partRarity: 0.018 },
    notable: {
      label: "Resonant Sieve",
      description: "Clears bias toward more forgeable top parts.",
      statBonuses: { partQuantity: 0.07, partRarity: 0.05 },
      modifiers: [{ id: "talent_loot_resonant_sieve_control", stat: "damage", type: "increased", value: 0.06, tags: ["control"] }],
    },
  },
  {
    clusterId: "flux",
    label: "Flux",
    anchor: { x: 53, y: 86 },
    requiredNodeId: "talent_iron_rotation",
    statA: { fluxGuard: 38 },
    statB: { reservationEfficiency: 0.025 },
    notable: {
      label: "Echo Capacitor",
      description: "Flux guard and reservation keep drive loops online.",
      statBonuses: { fluxGuard: 120, reservationEfficiency: 0.08 },
      modifiers: [{ id: "talent_flux_echo_capacitor", stat: "damage", type: "less", value: 0.05, condition: { kind: "attr", attr: "fluxRatio", op: "<", value: 0.35 } }],
    },
  },
  {
    clusterId: "thermal_mass",
    label: "Thermal Mass",
    anchor: { x: 58, y: 94 },
    requiredNodeId: "talent_guard_notable",
    statA: { mass: 0.14, inertiaBias: 0.05 },
    statB: { resonance: 0.055, grip: 0.035 },
    resistance: { heat: 0.02 },
    notable: {
      label: "Cinder Flywheel",
      description: "Heavy heat builds bank momentum into longer furnace pressure.",
      statBonuses: { mass: 0.24, resonance: 0.12, inertiaBias: 0.08 },
      resistanceBonuses: { heat: 0.04 },
      modifiers: [{ id: "talent_thermal_mass_cinder_flywheel", stat: "heat", type: "more", value: 0.1, tags: ["fire", "duration"] }],
    },
  },
  {
    clusterId: "arc_velocity",
    label: "Arc Velocity",
    anchor: { x: 91, y: 24 },
    requiredNodeId: "talent_speed_notable",
    statA: { rpm: 0.16, inertiaBias: -0.05 },
    statB: { resonance: 0.05, tracking: 30 },
    resistance: { static: 0.02 },
    notable: {
      label: "Volt Slipstream",
      description: "Fast resonance keeps chain arcs ahead of evasive packs.",
      statBonuses: { rpm: 0.28, resonance: 0.1, cooldownRecovery: 0.04 },
      modifiers: [{ id: "talent_arc_velocity_volt_slipstream", stat: "static", type: "more", value: 0.1, tags: ["lightning", "speed"] }],
    },
  },
  {
    clusterId: "splinter_flux",
    label: "Splinter Flux",
    anchor: { x: 25, y: 84 },
    requiredNodeId: "talent_flux_notable",
    statA: { edge: 0.014, fluxGuard: 42 },
    statB: { fracture: 0.04, reservationEfficiency: 0.02 },
    resistance: { glass: 0.018 },
    notable: {
      label: "Mirror Capacitor",
      description: "Critical glass builds spend stored flux into cleaner splinters.",
      statBonuses: { edge: 0.03, fracture: 0.09, fluxGuard: 90 },
      modifiers: [{ id: "talent_splinter_flux_mirror_capacitor", stat: "glass", type: "more", value: 0.11, tags: ["critical"] }],
    },
  },
  {
    clusterId: "iron_storm",
    label: "Iron Storm",
    anchor: { x: 82, y: 83 },
    requiredNodeId: "talent_static_notable",
    statA: { guard: 28, tracking: 24 },
    statB: { mass: 0.12, resonance: 0.045 },
    resistance: { static: 0.024 },
    notable: {
      label: "Grounded Coil",
      description: "Guarded lightning builds hold contact while arcs fork.",
      statBonuses: { guard: 74, tracking: 56, mass: 0.18 },
      resistanceBonuses: { static: 0.05 },
      modifiers: [{ id: "talent_iron_storm_grounded_coil", stat: "static", type: "penetration", value: 0.07, tags: ["lightning", "chain"] }],
    },
  },
  {
    clusterId: "route_engine",
    label: "Route Engine",
    anchor: { x: 7, y: 91 },
    requiredNodeId: "talent_loot_notable",
    statA: { partQuantity: 0.02, drift: 28 },
    statB: { partRarity: 0.018, cooldownRecovery: 0.025 },
    notable: {
      label: "Mapwright Dynamo",
      description: "Route-focused builds convert speed into cleaner reward loops.",
      statBonuses: { partQuantity: 0.06, partRarity: 0.045, cooldownRecovery: 0.05 },
      modifiers: [{ id: "talent_route_engine_mapwright_dynamo", stat: "damage", type: "increased", value: 0.08, tags: ["projectile", "chain"] }],
    },
  },
];

const clusterOffsets = [
  { x: -5, y: -5 },
  { x: 5, y: -5 },
  { x: -7, y: 5 },
  { x: 7, y: 5 },
  { x: 0, y: -11 },
  { x: 0, y: 11 },
];

function mergeStats(left?: TopStatBlock, right?: TopStatBlock): TopStatBlock | undefined {
  const next: TopStatBlock = { ...(left ?? {}) };
  for (const [stat, value] of Object.entries(right ?? {})) {
    next[stat as keyof TopStatBlock] = (next[stat as keyof TopStatBlock] ?? 0) + (value ?? 0);
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function makeCluster(spec: TalentClusterSpec): TalentNodeDef[] {
  const nodeId = (suffix: string) => `talent_${spec.clusterId}_${suffix}`;
  const pos = (index: number) => ({
    x: Math.min(96, Math.max(4, spec.anchor.x + clusterOffsets[index].x)),
    y: Math.min(96, Math.max(4, spec.anchor.y + clusterOffsets[index].y)),
  });

  return [
    {
      id: nodeId("entry"),
      displayName: `${spec.label} Entry`,
      description: `Opens the ${spec.label.toLowerCase()} circuit branch.`,
      cost: 1,
      position: pos(0),
      kind: "minor",
      clusterId: spec.clusterId,
      requiredNodeIds: [spec.requiredNodeId],
      statBonuses: spec.statA,
      resistanceBonuses: spec.resistance,
    },
    {
      id: nodeId("calibrator"),
      displayName: `${spec.label} Calibrator`,
      description: `Smooths the ${spec.label.toLowerCase()} branch into repeated runs.`,
      cost: 1,
      position: pos(1),
      kind: "minor",
      clusterId: spec.clusterId,
      requiredNodeIds: [nodeId("entry")],
      statBonuses: spec.statB,
    },
    {
      id: nodeId("path"),
      displayName: `${spec.label} Path`,
      description: `Adds a second route through the ${spec.label.toLowerCase()} wheel.`,
      cost: 1,
      position: pos(2),
      kind: "minor",
      clusterId: spec.clusterId,
      requiredNodeIds: [nodeId("entry")],
      statBonuses: mergeStats(spec.statA, spec.statB),
    },
    {
      id: nodeId("notable"),
      displayName: spec.notable.label,
      description: spec.notable.description,
      cost: 2,
      position: pos(3),
      kind: "notable",
      clusterId: spec.clusterId,
      requiredNodeIds: [nodeId("calibrator"), nodeId("path")],
      statBonuses: spec.notable.statBonuses,
      resistanceBonuses: spec.notable.resistanceBonuses,
      modifiers: spec.notable.modifiers,
    },
    {
      id: nodeId("mastery_a"),
      displayName: `${spec.label} Mastery`,
      description: `Specializes the ${spec.label.toLowerCase()} branch for late route clears.`,
      cost: 1,
      position: pos(4),
      kind: "minor",
      clusterId: spec.clusterId,
      requiredNodeIds: [nodeId("notable")],
      statBonuses: mergeStats(spec.statA, spec.notable.statBonuses),
      resistanceBonuses: spec.resistance,
    },
    {
      id: nodeId("mastery_b"),
      displayName: `${spec.label} Refinement`,
      description: `Adds final control to the ${spec.label.toLowerCase()} circuit.`,
      cost: 1,
      position: pos(5),
      kind: "minor",
      clusterId: spec.clusterId,
      requiredNodeIds: [nodeId("notable")],
      statBonuses: mergeStats(spec.statB, spec.notable.statBonuses),
      resistanceBonuses: spec.notable.resistanceBonuses,
    },
  ];
}

const keystoneNodes: TalentNodeDef[] = [
  {
    id: "talent_keystone_anchor_singularity",
    displayName: "Anchor Singularity",
    description: "Mass and grip suppress ring-out risk, but high-speed damage loses edge.",
    cost: 3,
    position: { x: 28, y: 91 },
    kind: "keystone",
    clusterId: "guard",
    requiredNodeIds: ["talent_guard_notable", "talent_flux_notable"],
    statBonuses: { mass: 0.72, grip: 0.58, rpm: -0.45, ringOutPressure: -0.5 },
    modifiers: [{ id: "talent_keystone_anchor_speed_less", stat: "damage", type: "less", value: 0.12, tags: ["speed"] }],
  },
  {
    id: "talent_keystone_glass_blade",
    displayName: "Glass Blade",
    description: "Critical edge spikes hard while the top gives up a large integrity buffer.",
    cost: 3,
    position: { x: 5, y: 23 },
    kind: "keystone",
    clusterId: "glass",
    requiredNodeIds: ["talent_glass_notable", "talent_impact_notable"],
    statBonuses: { edge: 0.09, fracture: 0.22, spinIntegrity: -260 },
    modifiers: [{ id: "talent_keystone_glass_blade_more", stat: "damage", type: "more", value: 0.18, tags: ["critical"] }],
  },
  {
    id: "talent_keystone_overload_bearing",
    displayName: "Overload Bearing",
    description: "At high omega all damage surges; below threshold the same bearing drags.",
    cost: 3,
    position: { x: 94, y: 18 },
    kind: "keystone",
    clusterId: "speed",
    requiredNodeIds: ["talent_speed_notable", "talent_static_notable"],
    statBonuses: { rpm: 0.4, cooldownRecovery: 0.06 },
    modifiers: [
      { id: "talent_keystone_overload_more", stat: "damage", type: "more", value: 0.25, condition: { kind: "attr", attr: "omega", op: ">=", value: 10 } },
      { id: "talent_keystone_overload_less", stat: "damage", type: "less", value: 0.15, condition: { kind: "attr", attr: "omega", op: "<", value: 10 } },
    ],
  },
  {
    id: "talent_keystone_centrifugal_orbit",
    displayName: "Centrifugal Orbit",
    description: "Ring pressure doubles down, but reduced grip makes bad rebounds dangerous.",
    cost: 3,
    position: { x: 98, y: 63 },
    kind: "keystone",
    clusterId: "arc_velocity",
    requiredNodeIds: ["talent_arc_velocity_notable", "talent_storm_lattice"],
    statBonuses: { ringOutPressure: 0.75, grip: -0.2, inertiaBias: -0.1 },
    modifiers: [{ id: "talent_keystone_centrifugal_speed", stat: "damage", type: "more", value: 0.14, tags: ["speed"] }],
  },
  {
    id: "talent_keystone_resonance_meltdown",
    displayName: "Resonance Meltdown",
    description: "Full flux turns every discharge volatile; empty flux drags the loop down.",
    cost: 3,
    position: { x: 67, y: 99 },
    kind: "keystone",
    clusterId: "thermal_mass",
    requiredNodeIds: ["talent_thermal_mass_notable", "talent_fire_notable"],
    statBonuses: { resonance: 0.22, fluxGuard: -80 },
    modifiers: [
      { id: "talent_keystone_meltdown_full_flux", stat: "damage", type: "more", value: 0.2, condition: { kind: "attr", attr: "fluxRatio", op: ">=", value: 0.9 } },
      { id: "talent_keystone_meltdown_empty_flux", stat: "damage", type: "less", value: 0.18, condition: { kind: "attr", attr: "fluxRatio", op: "<", value: 0.25 } },
    ],
  },
  {
    id: "talent_keystone_rim_fortress",
    displayName: "Rim Fortress",
    description: "A wide rim turns mass into punishing contact, at the cost of discharge tempo.",
    cost: 3,
    position: { x: 85, y: 96 },
    kind: "keystone",
    clusterId: "iron_storm",
    requiredNodeIds: ["talent_iron_storm_notable", "talent_thermal_mass_notable"],
    statBonuses: { mass: 0.52, inertiaBias: 0.18, guard: 110, cooldownRecovery: -0.06 },
    modifiers: [{ id: "talent_keystone_rim_fortress_thorns", stat: "impact", type: "more", value: 0.16, tags: ["physical", "thorns"] }],
  },
  {
    id: "talent_keystone_greedy_route",
    displayName: "Greedy Route",
    description: "Mapwright circuits pay out harder, but risk-tagged damage becomes the only clean offense.",
    cost: 3,
    position: { x: 4, y: 99 },
    kind: "keystone",
    clusterId: "route_engine",
    requiredNodeIds: ["talent_route_engine_notable", "talent_salvage_rites"],
    statBonuses: { partQuantity: 0.16, partRarity: 0.12, guard: -72, spinIntegrity: -140 },
    modifiers: [{ id: "talent_keystone_greedy_route_risk", stat: "damage", type: "more", value: 0.18, tags: ["risk"] }],
  },
];

export const talentNodes: TalentNodeDef[] = [...coreTalentNodes, ...clusterSpecs.flatMap(makeCluster), ...keystoneNodes];

export function getTalentNodeDef(talentId: string): TalentNodeDef {
  const talent = talentNodes.find((entry) => entry.id === talentId);
  if (!talent) {
    throw new Error(`Unknown talent node: ${talentId}`);
  }
  return talent;
}
