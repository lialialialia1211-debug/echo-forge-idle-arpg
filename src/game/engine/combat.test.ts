import { describe, expect, it } from "vitest";
import { createStarterBuild } from "./character";
import { resolveCombat } from "./combat";

describe("combat resolver", () => {
  it("produces stable positive combat outputs for a starter build", () => {
    const combat = resolveCombat(createStarterBuild("veilrunner"), "area_cinder_road");

    expect(combat.averageHit).toBeGreaterThan(100);
    expect(combat.dps).toBeGreaterThan(combat.averageHit);
    expect(combat.hitChance).toBeLessThanOrEqual(0.95);
    expect(combat.bossTimeToKill).toBeGreaterThan(0);
  });

  it("responds to stronger support links", () => {
    const base = createStarterBuild("ironbound");
    const weaker = { ...base, supportIds: [] };
    const linked = { ...base, supportIds: ["support_focused_force", "support_platebreaker", "support_lifebound"] };

    expect(resolveCombat(linked, "area_salt_catacomb").dps).toBeGreaterThan(
      resolveCombat(weaker, "area_salt_catacomb").dps,
    );
  });
});
