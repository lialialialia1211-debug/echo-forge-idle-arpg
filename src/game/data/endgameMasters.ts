export const endgameMasterSignals = ["routeClears", "arenaKeys", "materials", "bossGates", "rivals", "kills"] as const;

export type EndgameMasterSignal = (typeof endgameMasterSignals)[number];

export const endgameMasterRewardTargets = ["routeReward", "keySustain", "forgeControl", "affixControl", "materialLoop", "rivalDuel", "bossGate", "uniqueChase"] as const;

export type EndgameMasterRewardTarget = (typeof endgameMasterRewardTargets)[number];

export type EndgameMasterSignalWeight = {
  signal: EndgameMasterSignal;
  weight: number;
  target: number;
};

export type EndgameMasterNodeDef = {
  id: string;
  displayName: string;
  description: string;
  tier: 1 | 2 | 3 | 4;
  signal: EndgameMasterSignal;
  rewardTarget: EndgameMasterRewardTarget;
  weight: number;
  requiredNodeIds?: string[];
};

export type EndgameMasterDef = {
  id: string;
  displayName: string;
  description: string;
  maxActiveNodes: 4;
  rewardTargets: EndgameMasterRewardTarget[];
  signalWeights: EndgameMasterSignalWeight[];
  nodes: EndgameMasterNodeDef[];
};

export const endgameMasters: EndgameMasterDef[] = [
  {
    id: "master_mapwright",
    displayName: "Mapwright",
    description: "Turns route clears and spare keys into a stable endgame map loop.",
    maxActiveNodes: 4,
    rewardTargets: ["routeReward", "keySustain"],
    signalWeights: [
      { signal: "routeClears", weight: 0.4, target: 9 },
      { signal: "arenaKeys", weight: 0.22, target: 5 },
      { signal: "kills", weight: 0.16, target: 120 },
      { signal: "bossGates", weight: 0.16, target: 2 },
      { signal: "materials", weight: 0.06, target: 48 },
    ],
    nodes: [
      {
        id: "master_mapwright_route_survey",
        displayName: "Route Survey",
        description: "Open routes pay clearer completion signals.",
        tier: 1,
        signal: "routeClears",
        rewardTarget: "routeReward",
        weight: 1.12,
      },
      {
        id: "master_mapwright_blank_keys",
        displayName: "Blank Keys",
        description: "Keep more key blanks ready for chained runs.",
        tier: 1,
        signal: "arenaKeys",
        rewardTarget: "keySustain",
        weight: 1,
      },
      {
        id: "master_mapwright_basin_ledger",
        displayName: "Basin Ledger",
        description: "Pack clears feed the map reward ledger.",
        tier: 1,
        signal: "kills",
        rewardTarget: "routeReward",
        weight: 0.92,
      },
      {
        id: "master_mapwright_cache_route",
        displayName: "Cache Route",
        description: "Repeated clears bias rewards toward route caches.",
        tier: 2,
        signal: "routeClears",
        rewardTarget: "routeReward",
        weight: 1.18,
        requiredNodeIds: ["master_mapwright_route_survey"],
      },
      {
        id: "master_mapwright_key_recycling",
        displayName: "Key Recycling",
        description: "Keyed arenas return a stronger sustain path.",
        tier: 2,
        signal: "arenaKeys",
        rewardTarget: "keySustain",
        weight: 1.08,
        requiredNodeIds: ["master_mapwright_blank_keys"],
      },
      {
        id: "master_mapwright_signal_chart",
        displayName: "Signal Chart",
        description: "Boss gate scouting improves route selection.",
        tier: 2,
        signal: "bossGates",
        rewardTarget: "routeReward",
        weight: 0.96,
        requiredNodeIds: ["master_mapwright_basin_ledger"],
      },
      {
        id: "master_mapwright_stacked_exits",
        displayName: "Stacked Exits",
        description: "Stable exits stack extra route rewards.",
        tier: 3,
        signal: "routeClears",
        rewardTarget: "routeReward",
        weight: 1.24,
        requiredNodeIds: ["master_mapwright_cache_route"],
      },
      {
        id: "master_mapwright_toll_math",
        displayName: "Toll Math",
        description: "Material reserves smooth the cost of key pressure.",
        tier: 3,
        signal: "materials",
        rewardTarget: "keySustain",
        weight: 0.9,
        requiredNodeIds: ["master_mapwright_key_recycling"],
      },
      {
        id: "master_mapwright_apex_pin",
        displayName: "Apex Pin",
        description: "Boss gate progress pins higher tier map goals.",
        tier: 3,
        signal: "bossGates",
        rewardTarget: "routeReward",
        weight: 1.04,
        requiredNodeIds: ["master_mapwright_signal_chart"],
      },
      {
        id: "master_mapwright_endless_lane",
        displayName: "Endless Lane",
        description: "Route clears become a long sustain lane.",
        tier: 4,
        signal: "routeClears",
        rewardTarget: "routeReward",
        weight: 1.38,
        requiredNodeIds: ["master_mapwright_stacked_exits"],
      },
      {
        id: "master_mapwright_contract_press",
        displayName: "Contract Press",
        description: "Key stockpiles press into better route contracts.",
        tier: 4,
        signal: "arenaKeys",
        rewardTarget: "keySustain",
        weight: 1.26,
        requiredNodeIds: ["master_mapwright_toll_math"],
      },
      {
        id: "master_mapwright_brass_cartography",
        displayName: "Brass Cartography",
        description: "Boss gate knowledge bends the map toward payout routes.",
        tier: 4,
        signal: "bossGates",
        rewardTarget: "routeReward",
        weight: 1.16,
        requiredNodeIds: ["master_mapwright_apex_pin"],
      },
    ],
  },
  {
    id: "master_forgesmith",
    displayName: "Forgesmith",
    description: "Converts salvage, media, and route income into better affix control.",
    maxActiveNodes: 4,
    rewardTargets: ["forgeControl", "affixControl", "materialLoop"],
    signalWeights: [
      { signal: "materials", weight: 0.44, target: 72 },
      { signal: "kills", weight: 0.2, target: 110 },
      { signal: "routeClears", weight: 0.2, target: 7 },
      { signal: "arenaKeys", weight: 0.16, target: 4 },
    ],
    nodes: [
      {
        id: "master_forgesmith_scrap_tithe",
        displayName: "Scrap Tithe",
        description: "Salvage returns are routed into a cleaner material loop.",
        tier: 1,
        signal: "materials",
        rewardTarget: "materialLoop",
        weight: 1.18,
      },
      {
        id: "master_forgesmith_measured_heat",
        displayName: "Measured Heat",
        description: "Frequent combat keeps forge heat predictable.",
        tier: 1,
        signal: "kills",
        rewardTarget: "forgeControl",
        weight: 0.96,
      },
      {
        id: "master_forgesmith_media_bins",
        displayName: "Media Bins",
        description: "Keyed runs reserve more forge media.",
        tier: 1,
        signal: "arenaKeys",
        rewardTarget: "materialLoop",
        weight: 1,
      },
      {
        id: "master_forgesmith_reroll_jig",
        displayName: "Reroll Jig",
        description: "Material pressure becomes safer reroll control.",
        tier: 2,
        signal: "materials",
        rewardTarget: "forgeControl",
        weight: 1.2,
        requiredNodeIds: ["master_forgesmith_scrap_tithe"],
      },
      {
        id: "master_forgesmith_affix_clamp",
        displayName: "Affix Clamp",
        description: "Repeated routes teach the forge which tags to hold.",
        tier: 2,
        signal: "routeClears",
        rewardTarget: "affixControl",
        weight: 1.08,
        requiredNodeIds: ["master_forgesmith_measured_heat"],
      },
      {
        id: "master_forgesmith_quench_table",
        displayName: "Quench Table",
        description: "Combat volume cools bad rolls into usable stock.",
        tier: 2,
        signal: "kills",
        rewardTarget: "forgeControl",
        weight: 0.98,
        requiredNodeIds: ["master_forgesmith_media_bins"],
      },
      {
        id: "master_forgesmith_echo_mold",
        displayName: "Echo Mold",
        description: "Echo reserves increase high-value craft targeting.",
        tier: 3,
        signal: "materials",
        rewardTarget: "affixControl",
        weight: 1.26,
        requiredNodeIds: ["master_forgesmith_reroll_jig"],
      },
      {
        id: "master_forgesmith_engraving_lane",
        displayName: "Engraving Lane",
        description: "Route repetition raises engraving consistency.",
        tier: 3,
        signal: "routeClears",
        rewardTarget: "affixControl",
        weight: 1.16,
        requiredNodeIds: ["master_forgesmith_affix_clamp"],
      },
      {
        id: "master_forgesmith_keyed_furnace",
        displayName: "Keyed Furnace",
        description: "Key stock fuels deliberate forge sessions.",
        tier: 3,
        signal: "arenaKeys",
        rewardTarget: "forgeControl",
        weight: 1.08,
        requiredNodeIds: ["master_forgesmith_quench_table"],
      },
      {
        id: "master_forgesmith_masterwork_press",
        displayName: "Masterwork Press",
        description: "Large material piles make precision crafting viable.",
        tier: 4,
        signal: "materials",
        rewardTarget: "affixControl",
        weight: 1.42,
        requiredNodeIds: ["master_forgesmith_echo_mold"],
      },
      {
        id: "master_forgesmith_tempered_contract",
        displayName: "Tempered Contract",
        description: "Route contracts pay back into the forge table.",
        tier: 4,
        signal: "routeClears",
        rewardTarget: "materialLoop",
        weight: 1.22,
        requiredNodeIds: ["master_forgesmith_engraving_lane"],
      },
      {
        id: "master_forgesmith_null_sieve",
        displayName: "Null Sieve",
        description: "Bad outcomes are sieved into better next crafts.",
        tier: 4,
        signal: "kills",
        rewardTarget: "forgeControl",
        weight: 1.14,
        requiredNodeIds: ["master_forgesmith_keyed_furnace"],
      },
    ],
  },
  {
    id: "master_rivalhunter",
    displayName: "Rival Hunter",
    description: "Focuses boss gates, rivals, and unique chase goals into one hunt plan.",
    maxActiveNodes: 4,
    rewardTargets: ["rivalDuel", "bossGate", "uniqueChase"],
    signalWeights: [
      { signal: "rivals", weight: 0.36, target: 5 },
      { signal: "bossGates", weight: 0.3, target: 3 },
      { signal: "kills", weight: 0.18, target: 140 },
      { signal: "arenaKeys", weight: 0.16, target: 4 },
    ],
    nodes: [
      {
        id: "master_rivalhunter_name_board",
        displayName: "Name Board",
        description: "Known rivals are tracked as repeatable hunt targets.",
        tier: 1,
        signal: "rivals",
        rewardTarget: "rivalDuel",
        weight: 1.16,
      },
      {
        id: "master_rivalhunter_gate_scent",
        displayName: "Gate Scent",
        description: "Boss gate progress exposes better duel timing.",
        tier: 1,
        signal: "bossGates",
        rewardTarget: "bossGate",
        weight: 1.04,
      },
      {
        id: "master_rivalhunter_blooded_route",
        displayName: "Blooded Route",
        description: "Combat volume increases rare rival sightings.",
        tier: 1,
        signal: "kills",
        rewardTarget: "rivalDuel",
        weight: 0.94,
      },
      {
        id: "master_rivalhunter_contract_mark",
        displayName: "Contract Mark",
        description: "Cleared rivals leave stronger route marks.",
        tier: 2,
        signal: "rivals",
        rewardTarget: "uniqueChase",
        weight: 1.22,
        requiredNodeIds: ["master_rivalhunter_name_board"],
      },
      {
        id: "master_rivalhunter_phase_read",
        displayName: "Phase Read",
        description: "Boss gate records improve phase planning.",
        tier: 2,
        signal: "bossGates",
        rewardTarget: "bossGate",
        weight: 1.12,
        requiredNodeIds: ["master_rivalhunter_gate_scent"],
      },
      {
        id: "master_rivalhunter_keyed_lure",
        displayName: "Keyed Lure",
        description: "Stored keys become deliberate rival lures.",
        tier: 2,
        signal: "arenaKeys",
        rewardTarget: "rivalDuel",
        weight: 1.02,
        requiredNodeIds: ["master_rivalhunter_blooded_route"],
      },
      {
        id: "master_rivalhunter_trophy_wire",
        displayName: "Trophy Wire",
        description: "Rival clears raise the chance of chase drops.",
        tier: 3,
        signal: "rivals",
        rewardTarget: "uniqueChase",
        weight: 1.3,
        requiredNodeIds: ["master_rivalhunter_contract_mark"],
      },
      {
        id: "master_rivalhunter_boss_ledger",
        displayName: "Boss Ledger",
        description: "Gate history converts into cleaner boss attempts.",
        tier: 3,
        signal: "bossGates",
        rewardTarget: "bossGate",
        weight: 1.2,
        requiredNodeIds: ["master_rivalhunter_phase_read"],
      },
      {
        id: "master_rivalhunter_chase_pressure",
        displayName: "Chase Pressure",
        description: "High kill counts keep rival pressure online.",
        tier: 3,
        signal: "kills",
        rewardTarget: "uniqueChase",
        weight: 1.08,
        requiredNodeIds: ["master_rivalhunter_keyed_lure"],
      },
      {
        id: "master_rivalhunter_named_quarry",
        displayName: "Named Quarry",
        description: "Every cleared rival sharpens the named hunt.",
        tier: 4,
        signal: "rivals",
        rewardTarget: "uniqueChase",
        weight: 1.44,
        requiredNodeIds: ["master_rivalhunter_trophy_wire"],
      },
      {
        id: "master_rivalhunter_judicator_writ",
        displayName: "Judicator Writ",
        description: "Boss gates become formal endgame hunt contracts.",
        tier: 4,
        signal: "bossGates",
        rewardTarget: "bossGate",
        weight: 1.34,
        requiredNodeIds: ["master_rivalhunter_boss_ledger"],
      },
      {
        id: "master_rivalhunter_relic_scent",
        displayName: "Relic Scent",
        description: "Keyed hunts pull the route toward unique outcomes.",
        tier: 4,
        signal: "arenaKeys",
        rewardTarget: "uniqueChase",
        weight: 1.18,
        requiredNodeIds: ["master_rivalhunter_chase_pressure"],
      },
    ],
  },
];

export function getEndgameMasterDef(masterId: string): EndgameMasterDef {
  const master = endgameMasters.find((entry) => entry.id === masterId);
  if (!master) {
    throw new Error(`Unknown endgame master: ${masterId}`);
  }
  return master;
}

export function getEndgameMasterNodeDef(nodeId: string): EndgameMasterNodeDef {
  const node = endgameMasters.flatMap((master) => master.nodes).find((entry) => entry.id === nodeId);
  if (!node) {
    throw new Error(`Unknown endgame master node: ${nodeId}`);
  }
  return node;
}
