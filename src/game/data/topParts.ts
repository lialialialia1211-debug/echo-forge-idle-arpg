import { createRng } from "../engine/rng";
import type {
  ArenaDrop,
  TopModifierDef,
  TopPartBaseDef,
  TopPartInstance,
  TopPartRarity,
  TopPartSlotId,
  TopResistanceBlock,
  TopStatBlock,
} from "../engine/topTypes";

type PartAffixTemplate = {
  id: string;
  label: string;
  slots?: TopPartSlotId[];
  statBonuses?: TopStatBlock;
  resistanceBonuses?: TopResistanceBlock;
  modifiers?: TopModifierDef[];
};

export const partSlotOrder: TopPartSlotId[] = ["core", "attackRing", "weightDisk", "tip", "launcher", "seal", "circuitChip"];

export const partSlotLabels: Record<TopPartSlotId, string> = {
  core: "Core",
  attackRing: "Attack Ring",
  weightDisk: "Weight Disk",
  tip: "Tip",
  launcher: "Launcher",
  seal: "Seal",
  circuitChip: "Circuit Chip",
};

export const topPartBases: TopPartBaseDef[] = [
  {
    id: "part_core_ashwrought_heart",
    slot: "core",
    displayName: "Ashwrought Heart Core",
    tags: ["fire", "duration"],
    implicitStats: { spinIntegrity: 120, resonance: 0.08 },
    implicitResistances: { heat: 0.08 },
  },
  {
    id: "part_core_black_iron_wound",
    slot: "core",
    displayName: "Black-Iron Wound Core",
    tags: ["physical", "control"],
    implicitStats: { spinIntegrity: 170, guard: 36 },
    implicitResistances: { impact: 0.02 },
  },
  {
    id: "part_ring_serrated_halo",
    slot: "attackRing",
    displayName: "Serrated Halo Ring",
    tags: ["attack", "physical", "critical"],
    implicitStats: { impact: 24, edge: 0.02 },
  },
  {
    id: "part_ring_arc_teeth",
    slot: "attackRing",
    displayName: "Arc Teeth Ring",
    tags: ["spell", "lightning", "chain"],
    implicitStats: { tracking: 42 },
    implicitModifiers: [{ id: "arc_teeth_static_more", stat: "static", type: "more", value: 0.08, tags: ["lightning"] }],
  },
  {
    id: "part_disk_deep_bearing",
    slot: "weightDisk",
    displayName: "Deep Bearing Disk",
    tags: ["physical", "melee"],
    implicitStats: { mass: 0.08, guard: 58, grip: 0.04 },
  },
  {
    id: "part_disk_hollow_flywheel",
    slot: "weightDisk",
    displayName: "Hollow Flywheel Disk",
    tags: ["speed", "critical"],
    implicitStats: { rpm: 0.42, drift: 54 },
  },
  {
    id: "part_tip_needle",
    slot: "tip",
    displayName: "Needle Tip",
    tags: ["speed", "critical"],
    implicitStats: { rpm: 0.52, drift: 65 },
  },
  {
    id: "part_tip_anchor",
    slot: "tip",
    displayName: "Anchor Tip",
    tags: ["control", "physical"],
    implicitStats: { grip: 0.12, guard: 38, mass: 0.06 },
  },
  {
    id: "part_launcher_redline",
    slot: "launcher",
    displayName: "Redline Launcher",
    tags: ["speed", "fire"],
    implicitStats: { rpm: 0.35, resonance: 0.06 },
  },
  {
    id: "part_launcher_coil",
    slot: "launcher",
    displayName: "Echo Coil Launcher",
    tags: ["spell", "lightning"],
    implicitStats: { tracking: 55, resonance: 0.1 },
  },
  {
    id: "part_seal_storm",
    slot: "seal",
    displayName: "Storm Seal",
    tags: ["lightning", "chain"],
    implicitResistances: { static: 0.09 },
    implicitModifiers: [{ id: "storm_seal_static_pen", stat: "static", type: "penetration", value: 0.06, tags: ["lightning"] }],
  },
  {
    id: "part_seal_glassvein",
    slot: "seal",
    displayName: "Glassvein Seal",
    tags: ["cold", "critical"],
    implicitStats: { edge: 0.025 },
    implicitResistances: { glass: 0.1 },
  },
  {
    id: "part_chip_etched_route",
    slot: "circuitChip",
    displayName: "Etched Route Chip",
    tags: ["control"],
    implicitStats: { partQuantity: 0.08, tracking: 34 },
  },
  {
    id: "part_chip_brass_omen",
    slot: "circuitChip",
    displayName: "Brass Omen Chip",
    tags: ["critical"],
    implicitStats: { partRarity: 0.08, edge: 0.015 },
  },
];

const affixes: PartAffixTemplate[] = [
  { id: "affix_flat_impact", label: "Serrated", slots: ["attackRing"], statBonuses: { impact: 28 } },
  { id: "affix_more_impact", label: "Splintered", modifiers: [{ id: "affix_more_impact", stat: "impact", type: "more", value: 0.1, tags: ["attack"] }] },
  { id: "affix_rpm", label: "Redline", slots: ["tip", "launcher", "weightDisk"], statBonuses: { rpm: 0.38 } },
  { id: "affix_guard", label: "Deep-Bearing", slots: ["core", "weightDisk", "tip"], statBonuses: { guard: 62 } },
  { id: "affix_integrity", label: "Black-Iron", slots: ["core", "weightDisk"], statBonuses: { spinIntegrity: 160 } },
  { id: "affix_tracking", label: "Truecast", slots: ["launcher", "circuitChip", "attackRing"], statBonuses: { tracking: 72 } },
  { id: "affix_drift", label: "Wraith", slots: ["tip", "weightDisk"], statBonuses: { drift: 78 } },
  { id: "affix_edge", label: "Mirror-Tooth", slots: ["attackRing", "seal"], statBonuses: { edge: 0.035 } },
  { id: "affix_fracture", label: "False Impact", slots: ["attackRing", "seal", "circuitChip"], statBonuses: { fracture: 0.18 } },
  { id: "affix_resonance", label: "Echoing", slots: ["core", "launcher", "seal"], statBonuses: { resonance: 0.12 } },
  { id: "affix_heat_more", label: "Furnace", modifiers: [{ id: "affix_heat_more", stat: "heat", type: "more", value: 0.12, tags: ["fire"] }], resistanceBonuses: { heat: 0.05 } },
  { id: "affix_static_pen", label: "Volt-Etched", modifiers: [{ id: "affix_static_pen", stat: "static", type: "penetration", value: 0.08, tags: ["lightning"] }], resistanceBonuses: { static: 0.04 } },
  { id: "affix_quantity", label: "Scavenger", slots: ["circuitChip", "seal"], statBonuses: { partQuantity: 0.1 } },
  { id: "affix_rarity", label: "Omen", slots: ["circuitChip", "seal"], statBonuses: { partRarity: 0.1 } },
  {
    id: "affix_impact_as_heat",
    label: "Ashwrought",
    modifiers: [{ id: "affix_impact_as_heat", stat: "impact", type: "extraAs", value: 0.16, fromDamageType: "impact", toDamageType: "heat" }],
  },
  {
    id: "affix_impact_to_static",
    label: "Magnetized",
    modifiers: [{ id: "affix_impact_to_static", stat: "impact", type: "conversion", value: 0.18, fromDamageType: "impact", toDamageType: "static" }],
  },
];

const rarityAffixCount: Record<TopPartRarity, number> = {
  common: 0,
  tuned: 1,
  engraved: 3,
  relic: 4,
};

const rarityPrefixes: Record<TopPartRarity, string> = {
  common: "",
  tuned: "Tuned",
  engraved: "Engraved",
  relic: "Relic",
};

function addStats(a: TopStatBlock = {}, b: TopStatBlock = {}): TopStatBlock {
  const next: TopStatBlock = { ...a };
  for (const [stat, value] of Object.entries(b)) {
    next[stat as keyof TopStatBlock] = (next[stat as keyof TopStatBlock] ?? 0) + (value ?? 0);
  }
  return next;
}

function addResistances(a: TopResistanceBlock = {}, b: TopResistanceBlock = {}): TopResistanceBlock {
  const next: TopResistanceBlock = { ...a };
  for (const [type, value] of Object.entries(b)) {
    next[type as keyof TopResistanceBlock] = (next[type as keyof TopResistanceBlock] ?? 0) + (value ?? 0);
  }
  return next;
}

function cloneModifiers(modifiers: TopModifierDef[] = [], suffix: string): TopModifierDef[] {
  return modifiers.map((modifier) => ({ ...modifier, id: `${modifier.id}_${suffix}` }));
}

function buildPart({
  id,
  baseId,
  rarity,
  itemLevel,
  seed,
  sourceDropId,
}: {
  id: string;
  baseId: string;
  rarity: TopPartRarity;
  itemLevel: number;
  seed: string;
  sourceDropId?: string;
}): TopPartInstance {
  const base = getTopPartBaseDef(baseId);
  const rng = createRng(seed);
  const availableAffixes = affixes.filter((affix) => !affix.slots || affix.slots.includes(base.slot));
  const selectedAffixes: PartAffixTemplate[] = [];
  const affixCount = rarityAffixCount[rarity];

  while (selectedAffixes.length < affixCount && selectedAffixes.length < availableAffixes.length) {
    const affix = rng.pick(availableAffixes);
    if (!selectedAffixes.some((entry) => entry.id === affix.id)) {
      selectedAffixes.push(affix);
    }
  }

  const prefix = rarityPrefixes[rarity];
  const affixName = selectedAffixes[0]?.label;
  const displayName = [prefix, affixName, base.displayName].filter(Boolean).join(" ");
  let statBonuses = base.implicitStats ?? {};
  let resistanceBonuses = base.implicitResistances ?? {};
  let modifiers = cloneModifiers(base.implicitModifiers, id);

  for (const affix of selectedAffixes) {
    statBonuses = addStats(statBonuses, affix.statBonuses);
    resistanceBonuses = addResistances(resistanceBonuses, affix.resistanceBonuses);
    modifiers = [...modifiers, ...cloneModifiers(affix.modifiers, id)];
  }

  return {
    id,
    baseId,
    displayName,
    slot: base.slot,
    rarity,
    itemLevel,
    statBonuses,
    resistanceBonuses,
    modifiers,
    sourceDropId,
  };
}

function baseIdsForDropLabel(label: string): string[] {
  if (label.includes("Attack Ring")) {
    return topPartBases.filter((base) => base.slot === "attackRing").map((base) => base.id);
  }
  if (label.includes("Weight Disk")) {
    return topPartBases.filter((base) => base.slot === "weightDisk").map((base) => base.id);
  }
  if (label.includes("Needle Tip")) {
    return topPartBases.filter((base) => base.slot === "tip").map((base) => base.id);
  }
  if (label.includes("Core")) {
    return topPartBases.filter((base) => base.slot === "core").map((base) => base.id);
  }
  if (label.includes("Seal")) {
    return topPartBases.filter((base) => base.slot === "seal").map((base) => base.id);
  }
  if (label.includes("Launcher")) {
    return topPartBases.filter((base) => base.slot === "launcher").map((base) => base.id);
  }
  if (label.includes("Circuit Chip")) {
    return topPartBases.filter((base) => base.slot === "circuitChip").map((base) => base.id);
  }
  return topPartBases.map((base) => base.id);
}

export function getTopPartBaseDef(baseId: string): TopPartBaseDef {
  const base = topPartBases.find((entry) => entry.id === baseId);
  if (!base) {
    throw new Error(`Unknown top part base: ${baseId}`);
  }
  return base;
}

export function createStarterEquipment(): Record<TopPartSlotId, TopPartInstance> {
  return {
    core: buildPart({ id: "starter_core", baseId: "part_core_black_iron_wound", rarity: "common", itemLevel: 1, seed: "starter_core" }),
    attackRing: buildPart({ id: "starter_attack_ring", baseId: "part_ring_serrated_halo", rarity: "common", itemLevel: 1, seed: "starter_attack_ring" }),
    weightDisk: buildPart({ id: "starter_weight_disk", baseId: "part_disk_deep_bearing", rarity: "common", itemLevel: 1, seed: "starter_weight_disk" }),
    tip: buildPart({ id: "starter_tip", baseId: "part_tip_needle", rarity: "common", itemLevel: 1, seed: "starter_tip" }),
    launcher: buildPart({ id: "starter_launcher", baseId: "part_launcher_redline", rarity: "common", itemLevel: 1, seed: "starter_launcher" }),
    seal: buildPart({ id: "starter_seal", baseId: "part_seal_storm", rarity: "common", itemLevel: 1, seed: "starter_seal" }),
    circuitChip: buildPart({ id: "starter_circuit_chip", baseId: "part_chip_etched_route", rarity: "common", itemLevel: 1, seed: "starter_circuit_chip" }),
  };
}

export function createStarterInventory(): TopPartInstance[] {
  return [
    buildPart({ id: "starter_bag_ember_core", baseId: "part_core_ashwrought_heart", rarity: "tuned", itemLevel: 2, seed: "starter_bag_ember_core" }),
    buildPart({ id: "starter_bag_arc_ring", baseId: "part_ring_arc_teeth", rarity: "tuned", itemLevel: 2, seed: "starter_bag_arc_ring" }),
    buildPart({ id: "starter_bag_flywheel", baseId: "part_disk_hollow_flywheel", rarity: "tuned", itemLevel: 2, seed: "starter_bag_flywheel" }),
  ];
}

export function createPartFromArenaDrop(drop: ArenaDrop, arenaTier: number, wave: number): TopPartInstance {
  const rng = createRng(`${drop.id}_${drop.label}_${drop.rarity}_${arenaTier}_${wave}`);
  const candidateBaseIds = baseIdsForDropLabel(drop.label);
  const baseId = rng.pick(candidateBaseIds);

  return buildPart({
    id: `part_${drop.id}`,
    baseId,
    rarity: drop.rarity,
    itemLevel: Math.max(1, arenaTier * 3 + wave),
    seed: `${drop.id}_${baseId}`,
    sourceDropId: drop.id,
  });
}
