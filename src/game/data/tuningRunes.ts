import type { TuningRuneDef } from "../engine/topTypes";

export const tuningRunes: TuningRuneDef[] = [
  {
    id: "rune_splintered_edge",
    displayName: "Splintered Edge",
    requiredTags: ["projectile"],
    statBonuses: { edge: 0.025 },
    modifiers: [{ id: "rune_splintered_edge_more", stat: "impact", type: "more", value: 0.12, tags: ["projectile"] }],
  },
  {
    id: "rune_red_heat",
    displayName: "Red Heat",
    requiredTags: ["fire"],
    resistanceBonuses: { heat: 0.04 },
    modifiers: [{ id: "rune_red_heat_more", stat: "heat", type: "more", value: 0.14, tags: ["fire"] }],
  },
  {
    id: "rune_shock_fork",
    displayName: "Shock Fork",
    requiredTags: ["lightning", "chain"],
    statBonuses: { tracking: 38 },
    modifiers: [{ id: "rune_shock_fork_pen", stat: "static", type: "penetration", value: 0.09, tags: ["lightning"] }],
  },
  {
    id: "rune_deep_bearing",
    displayName: "Deep Bearing",
    requiredTags: ["physical"],
    statBonuses: { mass: 0.08, guard: 54 },
    modifiers: [{ id: "rune_deep_bearing_more", stat: "impact", type: "more", value: 0.08, tags: ["melee"] }],
  },
  {
    id: "rune_echo_coil",
    displayName: "Echo Coil",
    requiredTags: ["spell"],
    statBonuses: { resonance: 0.12, tracking: 42 },
    modifiers: [{ id: "rune_echo_coil_damage", stat: "damage", type: "increased", value: 0.18, tags: ["spell"] }],
  },
];

export function getTuningRuneDef(runeId: string): TuningRuneDef {
  const rune = tuningRunes.find((entry) => entry.id === runeId);
  if (!rune) {
    throw new Error(`Unknown tuning rune: ${runeId}`);
  }
  return rune;
}

export function isRuneCompatible(rune: TuningRuneDef, driveTags: string[]): boolean {
  return rune.requiredTags.some((tag) => driveTags.includes(tag));
}
