export type ChapterDef = {
  id: string;
  displayNameKey: string;
  nodeIds: string[];
  rivalIds: string[];
  bossGateId: string;
};

export const chapters: ChapterDef[] = [
  {
    id: "chapter_cinder",
    displayNameKey: "chapter.cinder.name",
    nodeIds: ["network_cinder_gate", "network_glass_branch", "network_rim_fortress", "network_brass_judicator"],
    rivalIds: ["rival_rim_warden"],
    bossGateId: "boss_gate_brass_judicator",
  },
];

export function getChapterDef(chapterId: string): ChapterDef {
  const chapter = chapters.find((entry) => entry.id === chapterId);
  if (!chapter) {
    throw new Error(`Unknown chapter: ${chapterId}`);
  }
  return chapter;
}
