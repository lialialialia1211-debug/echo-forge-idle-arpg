import { describe, expect, it } from "vitest";
import { shouldStartTalentDrag, TALENT_DRAG_THRESHOLD_PX } from "./TalentTreeView";

describe("TalentTreeView drag threshold", () => {
  it("keeps small pointer drift as a click", () => {
    expect(shouldStartTalentDrag(100, 100, 103, 104)).toBe(false);
    expect(Math.hypot(3, 4)).toBeLessThan(TALENT_DRAG_THRESHOLD_PX);
  });

  it("starts dragging once pointer movement crosses the threshold", () => {
    expect(shouldStartTalentDrag(100, 100, 106, 100)).toBe(true);
    expect(shouldStartTalentDrag(100, 100, 104, 105)).toBe(true);
  });
});
