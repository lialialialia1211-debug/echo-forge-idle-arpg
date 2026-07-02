import { describe, expect, it } from "vitest";
import { createCollisionPacket } from "./topCombat";
import type { TopRuntimeStats } from "./topTypes";
import { zeroResistances } from "./topTypes";

function createStats(overrides: Partial<TopRuntimeStats> = {}): TopRuntimeStats {
  return {
    maxSpinIntegrity: 1000,
    maxFluxGuard: 100,
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
    modifiers: [],
    ...overrides,
  };
}

describe("top combat projection", () => {
  it("keeps rpm out of per-hit collision damage", () => {
    const slow = createCollisionPacket(createStats({ rpm: 3 }));
    const fast = createCollisionPacket(createStats({ rpm: 12 }));

    expect(fast.impact).toBe(slow.impact);
  });

  it("uses mass as the collision damage seed", () => {
    const light = createCollisionPacket(createStats({ mass: 0.6 }));
    const heavy = createCollisionPacket(createStats({ mass: 1.4 }));

    expect(heavy.impact).toBeGreaterThan(light.impact);
  });

  it("does not use legacy impact as the physical seed", () => {
    const lowImpact = createCollisionPacket(createStats({ impact: 40 }));
    const highImpact = createCollisionPacket(createStats({ impact: 400 }));

    expect(highImpact.impact).toBe(lowImpact.impact);
  });
});
