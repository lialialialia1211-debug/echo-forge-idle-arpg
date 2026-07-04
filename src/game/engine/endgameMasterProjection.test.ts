import { describe, expect, it } from "vitest";
import { endgameMasters } from "../data/endgameMasters";
import { generateArenaKey } from "./arenaKeys";
import { projectAllEndgameMasters, projectEndgameMaster } from "./endgameMasterProjection";

const arenaKeys = Array.from({ length: 5 }, (_, index) =>
  generateArenaKey({
    arenaBaseId: "arena_cinder_crucible",
    rarity: "tuned",
    seed: `endgame_master_projection_${index}`,
    tier: 2,
  }),
);

describe("endgame master projection", () => {
  it("projects every endgame master with legal suggested nodes", () => {
    const projections = projectAllEndgameMasters({
      arenaKeys: [],
      clearedBossGateIds: [],
      clearedRivalIds: [],
      routeClears: {},
      totalKills: 0,
      wallet: { ash: 0, glass: 0, echo: 0 },
    });

    expect(projections).toHaveLength(endgameMasters.length);

    for (const projection of projections) {
      const master = endgameMasters.find((entry) => entry.id === projection.masterId)!;
      const masterNodeIds = new Set(master.nodes.map((node) => node.id));

      expect(projection.readiness).toBeGreaterThanOrEqual(0);
      expect(projection.readiness).toBeLessThanOrEqual(1);
      expect(projection.suggestedNodeIds.length).toBeGreaterThan(0);
      expect(projection.suggestedNodeIds.length).toBeLessThanOrEqual(master.maxActiveNodes);
      expect(projection.suggestedNodeIds.every((nodeId) => masterNodeIds.has(nodeId))).toBe(true);
      expect(master.signalWeights.some((entry) => entry.signal === projection.activeSignal)).toBe(true);
    }
  });

  it("raises mapwright readiness from route clears, keys, and boss gates", () => {
    const early = projectEndgameMaster("master_mapwright", {
      arenaKeys: [],
      clearedBossGateIds: [],
      routeClears: {},
      totalKills: 0,
      wallet: { ash: 0, glass: 0, echo: 0 },
    });
    const progressed = projectEndgameMaster("master_mapwright", {
      arenaKeys,
      clearedBossGateIds: ["boss_gate_brass_judicator", "boss_gate_echo"],
      routeClears: { arena_cinder_crucible: 9 },
      totalKills: 120,
      wallet: { ash: 10, glass: 4, echo: 1 },
    });

    expect(progressed.readiness).toBeGreaterThan(early.readiness);
    expect(progressed.activeSignal).toBe("routeClears");
    expect(progressed.suggestedNodeIds).toContain("master_mapwright_endless_lane");
  });

  it("leans forgesmith toward material-heavy affix control", () => {
    const projection = projectEndgameMaster("master_forgesmith", {
      arenaKeys: arenaKeys.slice(0, 3),
      routeClears: { arena_cinder_crucible: 4, arena_glass_mire_basin: 3 },
      totalKills: 110,
      wallet: { ash: 80, glass: 8, echo: 3 },
    });

    expect(projection.activeSignal).toBe("materials");
    expect(projection.readiness).toBeGreaterThan(0.8);
    expect(projection.suggestedNodeIds).toContain("master_forgesmith_masterwork_press");
  });

  it("leans rival hunter toward named rival and boss gate progress", () => {
    const projection = projectEndgameMaster("master_rivalhunter", {
      arenaKeys: arenaKeys.slice(0, 4),
      clearedBossGateIds: ["boss_gate_brass_judicator", "boss_gate_echo", "boss_gate_null"],
      clearedRivalIds: ["rival_sable_reflector", "rival_molten_knight", "rival_phase_widow", "rival_gravity_prelate", "rival_rim_warden"],
      totalKills: 140,
      wallet: { ash: 12, glass: 2, echo: 1 },
    });

    expect(projection.activeSignal).toBe("rivals");
    expect(projection.readiness).toBe(1);
    expect(projection.suggestedNodeIds).toContain("master_rivalhunter_named_quarry");
  });
});
