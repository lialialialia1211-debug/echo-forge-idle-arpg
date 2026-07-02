import { describe, expect, it } from "vitest";
import {
  attackFrequencyFromOmega,
  collisionImpactSeedFromMass,
  enemyArmorForFloor,
  initialSpinEnergy,
  levelPower,
  momentOfInertia,
  omegaFromEnergy,
  resolveDerivedTopPhysics,
  toDesignMass,
  towerRequirement,
} from "./topPhysics";

describe("top physics foundation", () => {
  it("bridges legacy mass into the design mass scale", () => {
    expect(toDesignMass(1)).toBe(5);
    expect(collisionImpactSeedFromMass(toDesignMass(1))).toBe(90);
  });

  it("derives inertia, omega, and attack frequency from spin energy", () => {
    const middle = resolveDerivedTopPhysics({
      mass: 1,
      volume: 5,
      force: 5,
      spinEnergy: initialSpinEnergy(5),
    });

    expect(middle.designMass).toBe(5);
    expect(middle.momentOfInertia).toBeCloseTo(momentOfInertia(5, 5), 5);
    expect(middle.omega).toBeCloseTo(omegaFromEnergy(1000, middle.momentOfInertia), 5);
    expect(middle.attackFrequency).toBeCloseTo(attackFrequencyFromOmega(middle.omega), 5);
    expect(middle.attackFrequency).toBeGreaterThan(0.95);
    expect(middle.attackFrequency).toBeLessThan(1.05);
  });

  it("keeps mass as hit quality and omega as hit quantity", () => {
    const light = resolveDerivedTopPhysics({ mass: 0.4, volume: 5, spinEnergy: 1000 });
    const heavy = resolveDerivedTopPhysics({ mass: 1.6, volume: 5, spinEnergy: 1000 });

    expect(collisionImpactSeedFromMass(heavy.designMass)).toBeGreaterThan(collisionImpactSeedFromMass(light.designMass));
    expect(light.attackFrequency).toBeGreaterThan(heavy.attackFrequency);
  });

  it("low spin energy naturally slows the top", () => {
    const full = resolveDerivedTopPhysics({ mass: 1, volume: 5, spinEnergy: 1000 });
    const low = resolveDerivedTopPhysics({ mass: 1, volume: 5, spinEnergy: 250 });

    expect(low.omega).toBeLessThan(full.omega);
    expect(low.attackFrequency).toBeLessThan(full.attackFrequency);
  });

  it("keeps progression curves in one config-backed helper", () => {
    expect(levelPower(1)).toBeCloseTo(10, 5);
    expect(towerRequirement(1)).toBeCloseTo(57.5, 5);
    expect(enemyArmorForFloor(24)).toBe(0);
    expect(enemyArmorForFloor(25)).toBeCloseTo(40, 5);
    expect(enemyArmorForFloor(45)).toBeGreaterThan(120);
  });
});
