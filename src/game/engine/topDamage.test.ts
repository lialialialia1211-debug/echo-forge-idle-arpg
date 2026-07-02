import { describe, expect, it } from "vitest";
import type { CombatContext } from "./conditionEval";
import { resolveTopHit } from "./topDamage";
import type { DriveCoreDef, TopModifierDef, TopRuntimeStats } from "./topTypes";
import { emptyDamagePacket, zeroResistances } from "./topTypes";

const neutralDrive: DriveCoreDef = {
  id: "test_drive",
  displayName: "Test Drive",
  tags: [],
  damageTypes: ["impact"],
  trigger: "onCooldown",
  baseCooldown: 1,
  baseDamage: emptyDamagePacket(),
  modifiers: [],
  visual: "sparks",
};

function createStats(modifiers: TopModifierDef[] = [], overrides: Partial<TopRuntimeStats> = {}): TopRuntimeStats {
  return {
    maxSpinIntegrity: 1000,
    maxFluxGuard: 0,
    guard: 0,
    drift: 0,
    tracking: 1000,
    impact: 100,
    rpm: 6,
    mass: 1,
    grip: 0.4,
    edge: 0,
    fracture: 1.5,
    resonance: 1,
    partQuantity: 0,
    partRarity: 0,
    resistances: zeroResistances(),
    modifiers,
    ...overrides,
  };
}

function createContext(overrides: Partial<CombatContext> = {}): CombatContext {
  return {
    physics: {
      designMass: 5,
      volume: 5,
      force: 5,
      spinEnergy: 800,
      momentOfInertia: 14,
      omega: 10,
      attackFrequency: 0.85,
      maxFlux: 108,
      fluxLowThreshold: 16.2,
    },
    spinEnergyRatio: 1,
    fluxRatio: 1,
    omega: 10,
    events: [],
    ...overrides,
  };
}

describe("top damage resolver", () => {
  it("applies flat/increased/more damage before hit chance", () => {
    const packet = emptyDamagePacket();
    packet.impact = 100;
    const attacker = createStats([
      { id: "flat_impact", stat: "impact", type: "flat", value: 20 },
      { id: "inc_impact", stat: "impact", type: "increased", value: 0.5 },
      { id: "more_damage", stat: "damage", type: "more", value: 0.2 },
    ]);

    const hit = resolveTopHit({
      baseDamage: packet,
      attacker,
      defender: createStats(),
      drive: neutralDrive,
      sourceTags: ["attack"],
    });

    expect(hit.rawDamage.impact).toBeCloseTo(216, 5);
    expect(hit.totalDamage).toBeCloseTo(205.2, 5);
  });

  it("reduces impact hits through guard mitigation", () => {
    const packet = emptyDamagePacket();
    packet.impact = 200;

    const unguarded = resolveTopHit({
      baseDamage: packet,
      attacker: createStats(),
      defender: createStats(),
      drive: neutralDrive,
      sourceTags: ["attack"],
    });

    const guarded = resolveTopHit({
      baseDamage: packet,
      attacker: createStats(),
      defender: createStats([], { guard: 800 }),
      drive: neutralDrive,
      sourceTags: ["attack"],
    });

    expect(guarded.totalDamage).toBeLessThan(unguarded.totalDamage);
  });

  it("lets penetration overcome matching resistance", () => {
    const packet = emptyDamagePacket();
    packet.static = 100;
    const defender = createStats([], { resistances: { ...zeroResistances(), static: 0.5 } });

    const resisted = resolveTopHit({
      baseDamage: packet,
      attacker: createStats(),
      defender,
      drive: neutralDrive,
      sourceTags: ["spell"],
    });

    const penetrated = resolveTopHit({
      baseDamage: packet,
      attacker: createStats([{ id: "static_pen", stat: "static", type: "penetration", value: 0.25 }]),
      defender,
      drive: neutralDrive,
      sourceTags: ["spell"],
    });

    expect(penetrated.totalDamage).toBeGreaterThan(resisted.totalDamage);
  });

  it("supports conversion and extra-as damage packets", () => {
    const packet = emptyDamagePacket();
    packet.impact = 100;
    const attacker = createStats([
      {
        id: "impact_to_heat",
        stat: "impact",
        type: "conversion",
        value: 0.5,
        fromDamageType: "impact",
        toDamageType: "heat",
      },
      {
        id: "heat_as_static",
        stat: "heat",
        type: "extraAs",
        value: 0.3,
        fromDamageType: "heat",
        toDamageType: "static",
      },
    ]);

    const hit = resolveTopHit({
      baseDamage: packet,
      attacker,
      defender: createStats(),
      drive: neutralDrive,
      sourceTags: ["attack"],
    });

    expect(hit.rawDamage.impact).toBeCloseTo(50, 5);
    expect(hit.rawDamage.heat).toBeCloseTo(50, 5);
    expect(hit.rawDamage.static).toBeCloseTo(15, 5);
  });

  it("applies event-gated modifiers only when the combat event is present", () => {
    const packet = emptyDamagePacket();
    packet.impact = 100;
    const drive = {
      ...neutralDrive,
      tags: ["melee"],
      modifiers: [{ id: "smash_more", stat: "impact", type: "more", value: 0.3, tags: ["melee"], condition: { kind: "event", event: "smash" } }],
    } satisfies DriveCoreDef;

    const idle = resolveTopHit({
      baseDamage: packet,
      attacker: createStats(),
      defender: createStats(),
      drive,
      sourceTags: ["attack", "melee"],
      context: createContext(),
    });
    const smash = resolveTopHit({
      baseDamage: packet,
      attacker: createStats(),
      defender: createStats(),
      drive,
      sourceTags: ["attack", "melee"],
      context: createContext({ events: [{ kind: "smash", sourceId: "player_top", targetId: "enemy_1", magnitude: 120, x: 0, y: 0 }] }),
    });

    expect(idle.rawDamage.impact).toBeCloseTo(100, 5);
    expect(smash.rawDamage.impact).toBeCloseTo(130, 5);
  });

  it("applies attribute-gated modifiers from combat context", () => {
    const packet = emptyDamagePacket();
    packet.impact = 100;
    const attacker = createStats([{ id: "low_energy_more", stat: "impact", type: "more", value: 0.25, condition: { kind: "attr", attr: "spinEnergyRatio", op: "<", value: 0.5 } }]);

    const highEnergy = resolveTopHit({
      baseDamage: packet,
      attacker,
      defender: createStats(),
      drive: neutralDrive,
      sourceTags: ["attack"],
      context: createContext({ spinEnergyRatio: 0.8 }),
    });
    const lowEnergy = resolveTopHit({
      baseDamage: packet,
      attacker,
      defender: createStats(),
      drive: neutralDrive,
      sourceTags: ["attack"],
      context: createContext({ spinEnergyRatio: 0.32 }),
    });

    expect(highEnergy.rawDamage.impact).toBeCloseTo(100, 5);
    expect(lowEnergy.rawDamage.impact).toBeCloseTo(125, 5);
  });
});
