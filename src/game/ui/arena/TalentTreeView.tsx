import { LocateFixed, ZoomIn, ZoomOut } from "lucide-react";
import { useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from "react";
import type { TalentNodeDef } from "../../engine/topTypes";
import { dataDescription, dataName, t } from "../../locale/zh-Hant";

type TalentTreeViewProps = {
  nodes: TalentNodeDef[];
  activeTalentIds: string[];
  selectedTalentId: string;
  canUseTalent: (talentId: string) => boolean;
  onSelectTalent: (talentId: string) => void;
};

type TalentTreeViewState = {
  x: number;
  y: number;
  scale: number;
};

type DragState = {
  pointerId: number;
  x: number;
  y: number;
};

const initialView: TalentTreeViewState = { x: 0, y: 0, scale: 1 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function TalentTreeView({ nodes, activeTalentIds, selectedTalentId, canUseTalent, onSelectTalent }: TalentTreeViewProps) {
  const [view, setView] = useState<TalentTreeViewState>(initialView);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const activeSet = new Set(activeTalentIds);

  const adjustScale = (delta: number) => {
    setView((current) => ({ ...current, scale: clamp(current.scale + delta, 0.62, 1.85) }));
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    adjustScale(event.deltaY > 0 ? -0.12 : 0.12);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".talent-board-controls")) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setView((current) => ({
      ...current,
      x: clamp(current.x + dx, -420, 420),
      y: clamp(current.y + dy, -420, 420),
    }));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    setDragging(false);
  };

  const viewportStyle = {
    "--talent-tree-x": `${view.x}px`,
    "--talent-tree-y": `${view.y}px`,
    "--talent-tree-scale": view.scale,
  } as CSSProperties;

  return (
    <div
      aria-label="天賦盤"
      className={dragging ? "talent-board talent-board-dragging" : "talent-board"}
      onPointerCancel={endDrag}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onWheel={onWheel}
    >
      <div className="talent-board-controls">
        <button aria-label="縮小" onClick={() => adjustScale(-0.14)} title="縮小" type="button">
          <ZoomOut size={15} aria-hidden />
        </button>
        <span>{Math.round(view.scale * 100)}%</span>
        <button aria-label="放大" onClick={() => adjustScale(0.14)} title="放大" type="button">
          <ZoomIn size={15} aria-hidden />
        </button>
        <button aria-label={t("ui.control.reset")} onClick={() => setView(initialView)} title={t("ui.control.reset")} type="button">
          <LocateFixed size={15} aria-hidden />
        </button>
      </div>
      <div className="talent-board-viewport" style={viewportStyle}>
        <svg className="talent-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {nodes.flatMap((node) =>
            (node.requiredNodeIds ?? []).map((requiredId) => {
              const from = nodeById.get(requiredId)?.position;
              const to = node.position;
              const active = activeSet.has(requiredId) && activeSet.has(node.id);
              return from && to ? <line className={active ? "talent-link talent-link-active" : "talent-link"} key={`${requiredId}-${node.id}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} /> : null;
            }),
          )}
        </svg>
        {nodes.map((node) => {
          const active = activeSet.has(node.id);
          const available = canUseTalent(node.id);
          const selected = selectedTalentId === node.id;
          const position = node.position;
          const talentClass = ["talent-node", `talent-node-${node.kind}`, active ? "talent-node-active" : "", selected ? "talent-node-selected" : "", !active && !available ? "talent-node-locked" : ""]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              aria-pressed={selected}
              className={talentClass}
              key={node.id}
              onClick={() => onSelectTalent(node.id)}
              style={{ "--talent-x": `${position.x}%`, "--talent-y": `${position.y}%` } as CSSProperties}
              title={dataDescription("talent", node.id, node.description)}
              type="button"
            >
              <small>{node.cost} {t("ui.point.short")}</small>
              <strong>{dataName("talent", node.id, node.displayName)}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}
