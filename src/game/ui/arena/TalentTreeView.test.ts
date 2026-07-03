import { describe, expect, it } from "vitest";
import type { TalentNodeDef } from "../../engine/topTypes";
import { selectTalentFogState, shouldStartTalentDrag, TALENT_DRAG_THRESHOLD_PX } from "./TalentTreeView";

describe("TalentTreeView drag threshold", () => {
  it("keeps small pointer drift as a click", () => {
    expect(shouldStartTalentDrag(100, 100, 103, 104)).toBe(false);
    expect(Math.hypot(3, 4)).toBeLessThan(TALENT_DRAG_THRESHOLD_PX);
  });

  it("starts dragging once pointer movement crosses the threshold", () => {
    expect(shouldStartTalentDrag(100, 100, 106, 100)).toBe(true);
    expect(shouldStartTalentDrag(100, 100, 104, 105)).toBe(true);
  });

  it("reveals active, available, and one-step-preview talents only", () => {
    const active = new Set(["root"]);
    const available = new Set(["branch"]);
    const makeNode = (id: string, requiredNodeIds?: string[]): TalentNodeDef => ({
      id,
      displayName: id,
      description: "",
      kind: "minor",
      cost: 1,
      position: { x: 0, y: 0 },
      statBonuses: {},
      requiredNodeIds,
    });

    expect(selectTalentFogState(makeNode("root"), active, available)).toBe("revealed");
    expect(selectTalentFogState(makeNode("branch", ["root"]), active, available)).toBe("revealed");
    expect(selectTalentFogState(makeNode("preview", ["branch"]), active, available)).toBe("preview");
    expect(selectTalentFogState(makeNode("deep", ["preview"]), active, available)).toBe("fogged");
  });
});
