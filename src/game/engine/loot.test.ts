import { describe, expect, it } from "vitest";
import { createStarterBuild } from "./character";
import { resolveCombat } from "./combat";
import { resolveDefense } from "./defense";
import { resolveLoot } from "./loot";

describe("loot resolver", () => {
  it("reduces farm efficiency when death pressure is high", () => {
    const build = createStarterBuild("ashweaver");
    const combat = resolveCombat(build, "area_echo_vault");
    const defense = resolveDefense(build, "area_echo_vault");
    const loot = resolveLoot(build, "area_echo_vault", combat, defense);

    expect(loot.farmEfficiency).toBeLessThan(1);
    expect(loot.itemsPerHour).toBeGreaterThanOrEqual(0);
  });

  it("calculates meaningful rewards in an early route", () => {
    const build = createStarterBuild("veilrunner");
    const combat = resolveCombat(build, "area_cinder_road");
    const defense = resolveDefense(build, "area_cinder_road");
    const loot = resolveLoot(build, "area_cinder_road", combat, defense);

    expect(loot.killsPerHour).toBeGreaterThan(0);
    expect(loot.totalEvPerHour).toBeGreaterThan(loot.currencyPerHour);
  });
});
