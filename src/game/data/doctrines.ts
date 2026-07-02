import type { DoctrineDef, DoctrineRule, TopModifierDef, TopResistanceBlock, TopStatBlock } from "../engine/topTypes";

export type DoctrineBonuses = {
  statBonuses: TopStatBlock;
  resistanceBonuses: TopResistanceBlock;
  modifiers: TopModifierDef[];
  rules: DoctrineRule[];
};

export const doctrines: DoctrineDef[] = [
  {
    id: "doctrine_swift_razor_edge",
    frameId: "frame_swift_razor",
    displayName: "Razor Monastery",
    description: "Turns high edge and contact uptime into glass bleed pressure.",
    nodes: [
      {
        id: "doctrine_swift_razor_edge_1",
        displayName: "Cutting Line",
        description: "Sharper contact geometry.",
        statBonuses: { edge: 0.035, tracking: 44 },
      },
      {
        id: "doctrine_swift_razor_edge_2",
        displayName: "Splinter Kata",
        description: "Critical hits gain glass follow-through.",
        modifiers: [{ id: "doctrine_swift_razor_glass_more", stat: "glass", type: "more", value: 0.16, tags: ["critical"] }],
        rule: "precisionBleed",
      },
      {
        id: "doctrine_swift_razor_edge_3",
        displayName: "White Scar",
        description: "Fracture rises at the cost of guard.",
        statBonuses: { fracture: 0.18, guard: -38 },
      },
    ],
  },
  {
    id: "doctrine_swift_orbit_duelist",
    frameId: "frame_swift_razor",
    displayName: "Orbit Duelist",
    description: "Trades some burst for safer ring pressure and dueling control.",
    nodes: [
      {
        id: "doctrine_swift_orbit_duelist_1",
        displayName: "Low Orbit",
        description: "More grip during close pursuit.",
        statBonuses: { grip: 0.22, drift: -60 },
      },
      {
        id: "doctrine_swift_orbit_duelist_2",
        displayName: "Rail Hook",
        description: "Ring-out pressure becomes a build axis.",
        statBonuses: { ringOutPressure: 0.42, mass: 0.18 },
        rule: "anchorMass",
      },
      {
        id: "doctrine_swift_orbit_duelist_3",
        displayName: "Duel Tempo",
        description: "Collision drives recover faster.",
        statBonuses: { cooldownRecovery: 0.09 },
        modifiers: [{ id: "doctrine_swift_orbit_melee", stat: "impact", type: "more", value: 0.08, tags: ["melee"] }],
      },
    ],
  },
  {
    id: "doctrine_ember_rail_monk",
    frameId: "frame_ember_crucible",
    displayName: "Molten Rail Monk",
    description: "Self-made hazard rails become safe lanes for heat control.",
    nodes: [
      {
        id: "doctrine_ember_rail_monk_1",
        displayName: "Ashen Footwork",
        description: "Heat resistance and grip stabilize hazard play.",
        statBonuses: { grip: 0.12 },
        resistanceBonuses: { heat: 0.08 },
      },
      {
        id: "doctrine_ember_rail_monk_2",
        displayName: "Friendly Groove",
        description: "Own furnace rails no longer punish the player.",
        rule: "selfHazardSafe",
      },
      {
        id: "doctrine_ember_rail_monk_3",
        displayName: "Cinder Mantra",
        description: "Duration heat damage scales harder.",
        modifiers: [{ id: "doctrine_ember_rail_heat", stat: "heat", type: "more", value: 0.15, tags: ["duration"] }],
      },
    ],
  },
  {
    id: "doctrine_ember_ash_reclaimer",
    frameId: "frame_ember_crucible",
    displayName: "Ash Reclaimer",
    description: "Flux guard feeds longer drive loops and safer recovery.",
    nodes: [
      {
        id: "doctrine_ember_reclaimer_1",
        displayName: "Guarded Furnace",
        description: "A thicker flux shell.",
        statBonuses: { fluxGuard: 140, guard: 28 },
      },
      {
        id: "doctrine_ember_reclaimer_2",
        displayName: "Echo Draft",
        description: "Low flux reduces incoming pressure.",
        modifiers: [{ id: "doctrine_ember_reclaimer_low_flux", stat: "damage", type: "less", value: 0.08, condition: { kind: "attr", attr: "fluxRatio", op: "<", value: 0.4 } }],
        rule: "fluxRecursion",
      },
      {
        id: "doctrine_ember_reclaimer_3",
        displayName: "Ash Dividend",
        description: "Control builds find more forgeable parts.",
        statBonuses: { partQuantity: 0.09, partRarity: 0.04 },
      },
    ],
  },
  {
    id: "doctrine_storm_chain_savant",
    frameId: "frame_storm_needle",
    displayName: "Chain Savant",
    description: "Static chain routes favor repeat triggers and penetration.",
    nodes: [
      {
        id: "doctrine_storm_savant_1",
        displayName: "Needle Focus",
        description: "Tracking and resonance tighten arcs.",
        statBonuses: { tracking: 72, resonance: 0.1 },
      },
      {
        id: "doctrine_storm_savant_2",
        displayName: "Conduit Index",
        description: "Static chain ignores more resistance.",
        modifiers: [{ id: "doctrine_storm_savant_pen", stat: "static", type: "penetration", value: 0.12, tags: ["chain"] }],
        rule: "stormConduit",
      },
      {
        id: "doctrine_storm_savant_3",
        displayName: "Forked Pulse",
        description: "Chain damage gains a direct more multiplier.",
        modifiers: [{ id: "doctrine_storm_savant_more", stat: "static", type: "more", value: 0.13, tags: ["lightning"] }],
      },
    ],
  },
  {
    id: "doctrine_storm_overload_axis",
    frameId: "frame_storm_needle",
    displayName: "Overload Axis",
    description: "High omega unlocks major damage, while slow rotations drag.",
    nodes: [
      {
        id: "doctrine_storm_overload_1",
        displayName: "Live Axis",
        description: "Higher rpm with a lighter shell.",
        statBonuses: { rpm: 0.55, mass: -0.08 },
      },
      {
        id: "doctrine_storm_overload_2",
        displayName: "Overload Window",
        description: "Damage surges above omega threshold.",
        modifiers: [
          { id: "doctrine_storm_overload_more", stat: "damage", type: "more", value: 0.2, condition: { kind: "attr", attr: "omega", op: ">=", value: 11 } },
          { id: "doctrine_storm_overload_less", stat: "damage", type: "less", value: 0.1, condition: { kind: "attr", attr: "omega", op: "<", value: 11 } },
        ],
        rule: "overloadSurge",
      },
      {
        id: "doctrine_storm_overload_3",
        displayName: "Static Flywheel",
        description: "Cooldown recovery for rapid discharge loops.",
        statBonuses: { cooldownRecovery: 0.12, fluxGuard: 70 },
      },
    ],
  },
];

function addStats(left: TopStatBlock = {}, right: TopStatBlock = {}): TopStatBlock {
  const next: TopStatBlock = { ...left };
  for (const [stat, value] of Object.entries(right)) {
    next[stat as keyof TopStatBlock] = (next[stat as keyof TopStatBlock] ?? 0) + (value ?? 0);
  }
  return next;
}

function addResistances(left: TopResistanceBlock = {}, right: TopResistanceBlock = {}): TopResistanceBlock {
  const next: TopResistanceBlock = { ...left };
  for (const [type, value] of Object.entries(right)) {
    next[type as keyof TopResistanceBlock] = (next[type as keyof TopResistanceBlock] ?? 0) + (value ?? 0);
  }
  return next;
}

export function getDoctrineDef(doctrineId: string): DoctrineDef {
  const doctrine = doctrines.find((entry) => entry.id === doctrineId);
  if (!doctrine) {
    throw new Error(`Unknown doctrine: ${doctrineId}`);
  }
  return doctrine;
}

export function doctrineForFrame(frameId: string): DoctrineDef[] {
  return doctrines.filter((entry) => entry.frameId === frameId);
}

export function resolveDoctrineBonuses(doctrineId?: string | null): DoctrineBonuses {
  if (!doctrineId) {
    return { statBonuses: {}, resistanceBonuses: {}, modifiers: [], rules: [] };
  }
  const doctrine = getDoctrineDef(doctrineId);
  return doctrine.nodes.reduce<DoctrineBonuses>(
    (bonuses, node) => ({
      statBonuses: addStats(bonuses.statBonuses, node.statBonuses),
      resistanceBonuses: addResistances(bonuses.resistanceBonuses, node.resistanceBonuses),
      modifiers: [...bonuses.modifiers, ...(node.modifiers ?? [])],
      rules: node.rule ? [...bonuses.rules, node.rule] : bonuses.rules,
    }),
    { statBonuses: {}, resistanceBonuses: {}, modifiers: [], rules: [] },
  );
}
