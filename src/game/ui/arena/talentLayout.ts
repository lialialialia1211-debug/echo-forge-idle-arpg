import type { TalentNodeDef } from "../../engine/topTypes";

export const TALENT_WORLD_WIDTH = 1760;
export const TALENT_WORLD_HEIGHT = 1200;
export const TALENT_WORLD_PADDING = 24;
export const TALENT_NODE_SIZES: Record<TalentNodeDef["kind"], { width: number; height: number }> = {
  minor: { width: 82, height: 52 },
  notable: { width: 96, height: 60 },
  keystone: { width: 112, height: 70 },
};
