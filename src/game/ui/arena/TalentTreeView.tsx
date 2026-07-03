import { LocateFixed, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from "react";
import type { TalentNodeDef } from "../../engine/topTypes";
import { dataName, t } from "../../locale/zh-Hant";

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
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  dragging: boolean;
};

const initialView: TalentTreeViewState = { x: 0, y: 0, scale: 1 };
export const TALENT_DRAG_THRESHOLD_PX = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function shouldStartTalentDrag(startX: number, startY: number, currentX: number, currentY: number, threshold = TALENT_DRAG_THRESHOLD_PX): boolean {
  return Math.hypot(currentX - startX, currentY - startY) >= threshold;
}

export function TalentTreeView({ nodes, activeTalentIds, selectedTalentId, canUseTalent, onSelectTalent }: TalentTreeViewProps) {
  const [view, setView] = useState<TalentTreeViewState>(initialView);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const activeSet = new Set(activeTalentIds);
  const clusterRegions = useMemo(() => {
    const groups = new Map<string, TalentNodeDef[]>();
    for (const node of nodes) {
      if (!node.clusterId || node.clusterId === "core") {
        continue;
      }
      groups.set(node.clusterId, [...(groups.get(node.clusterId) ?? []), node]);
    }
    return Array.from(groups.entries()).map(([clusterId, clusterNodes], index) => {
      const xs = clusterNodes.map((node) => node.position.x);
      const ys = clusterNodes.map((node) => node.position.y);
      const left = clamp(Math.min(...xs) - 8, 0, 100);
      const top = clamp(Math.min(...ys) - 8, 0, 100);
      const right = clamp(Math.max(...xs) + 8, 0, 100);
      const bottom = clamp(Math.max(...ys) + 8, 0, 100);
      return { clusterId, index, left, top, width: Math.max(8, right - left), height: Math.max(8, bottom - top) };
    });
  }, [nodes]);

  const adjustScale = (delta: number) => {
    setView((current) => ({ ...current, scale: clamp(current.scale + delta, 0.62, 1.85) }));
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    adjustScale(event.deltaY > 0 ? -0.12 : 0.12);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".talent-board-controls")) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dragging: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    if (!drag.dragging && !shouldStartTalentDrag(drag.startX, drag.startY, event.clientX, event.clientY)) {
      return;
    }

    if (!drag.dragging) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }

    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    dragRef.current = { ...drag, lastX: event.clientX, lastY: event.clientY, dragging: true };
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
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
        {clusterRegions.map((region) => (
          <div
            className={`talent-cluster-region talent-cluster-region-${region.index % 6}`}
            key={region.clusterId}
            style={
              {
                "--talent-cluster-left": `${region.left}%`,
                "--talent-cluster-top": `${region.top}%`,
                "--talent-cluster-width": `${region.width}%`,
                "--talent-cluster-height": `${region.height}%`,
              } as CSSProperties
            }
          />
        ))}
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
