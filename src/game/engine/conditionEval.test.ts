import { describe, expect, it } from "vitest";
import { evaluateCombatCondition, type CombatContext } from "./conditionEval";

const context: CombatContext = {
  physics: {
    designMass: 6.2,
    volume: 5,
    force: 5,
    spinEnergy: 600,
    momentOfInertia: 12,
    omega: 10,
    attackFrequency: 0.85,
    maxFlux: 110,
    fluxLowThreshold: 16.5,
  },
  spinEnergyRatio: 0.42,
  fluxRatio: 0.28,
  omega: 10,
  events: [
    {
      kind: "smash",
      sourceId: "player_top",
      targetId: "enemy_1",
      magnitude: 180,
      x: 4,
      y: 2,
    },
  ],
};

describe("combat condition evaluator", () => {
  it("evaluates attribute comparisons", () => {
    expect(evaluateCombatCondition({ kind: "attr", attr: "mass", op: ">=", value: 6 }, context)).toBe(true);
    expect(evaluateCombatCondition({ kind: "attr", attr: "spinEnergyRatio", op: "<", value: 0.5 }, context)).toBe(true);
    expect(evaluateCombatCondition({ kind: "attr", attr: "omega", op: ">", value: 12 }, context)).toBe(false);
  });

  it("evaluates event conditions", () => {
    expect(evaluateCombatCondition({ kind: "event", event: "smash" }, context)).toBe(true);
    expect(evaluateCombatCondition({ kind: "event", event: "ringout" }, context)).toBe(false);
  });

  it("evaluates nested and/or conditions", () => {
    expect(
      evaluateCombatCondition(
        {
          kind: "and",
          terms: [
            { kind: "attr", attr: "mass", op: ">=", value: 6 },
            { kind: "event", event: "smash" },
          ],
        },
        context,
      ),
    ).toBe(true);
    expect(
      evaluateCombatCondition(
        {
          kind: "or",
          terms: [
            { kind: "attr", attr: "omega", op: ">", value: 12 },
            { kind: "event", event: "discharge" },
            { kind: "attr", attr: "fluxRatio", op: "<=", value: 0.3 },
          ],
        },
        context,
      ),
    ).toBe(true);
  });
});
