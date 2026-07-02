import type { CircuitNetworkNodeDef } from "../engine/topTypes";

export const circuitNetworkNodes: CircuitNetworkNodeDef[] = [
  {
    id: "network_cinder_gate",
    displayName: "Cinder Gate",
    description: "The first stable route into the endgame network.",
    arenaId: "arena_cinder_crucible",
  },
  {
    id: "network_glass_branch",
    displayName: "Glass Branch",
    description: "A higher reward branch through the mire basin.",
    arenaId: "arena_glass_mire_basin",
    requiredNodeIds: ["network_cinder_gate"],
  },
  {
    id: "network_brass_judicator",
    displayName: "Brass Judicator Gate",
    description: "Unlocked by proving the duel gate in live combat.",
    arenaId: "arena_red_chancel_disk",
    requiredNodeIds: ["network_glass_branch"],
    requiredBossGateId: "boss_gate_brass_judicator",
  },
  {
    id: "network_flux_monsoon",
    displayName: "Flux Monsoon Anomaly",
    description: "First anomaly route. Stronger rivals, better rewards.",
    arenaId: "arena_red_chancel_disk",
    requiredNodeIds: ["network_brass_judicator"],
    requiredBossGateId: "boss_gate_brass_judicator",
    anomalyId: "anomaly_flux_monsoon",
  },
];
