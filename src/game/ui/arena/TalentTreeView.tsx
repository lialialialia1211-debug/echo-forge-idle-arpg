import { LocateFixed, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from "react";
import type { TalentNodeDef } from "../../engine/topTypes";
import { dataName, t } from "../../locale/zh-Hant";
import { TALENT_WORLD_HEIGHT, TALENT_WORLD_PADDING, TALENT_WORLD_WIDTH } from "./talentLayout";

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

type TalentBoardSize = {
  width: number;
  height: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  dragging: boolean;
};

const initialBoardSize: TalentBoardSize = { width: 0, height: 0 };
const initialView: TalentTreeViewState = { x: 0, y: 0, scale: 1 };
export const TALENT_DRAG_THRESHOLD_PX = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function shouldStartTalentDrag(startX: number, startY: number, currentX: number, currentY: number, threshold = TALENT_DRAG_THRESHOLD_PX): boolean {
  return Math.hypot(currentX - startX, currentY - startY) >= threshold;
}

function fitScaleForBoard(boardSize: TalentBoardSize): number {
  if (boardSize.width <= 0 || boardSize.height <= 0) {
    return 1;
  }
  return clamp(Math.min(boardSize.width / TALENT_WORLD_WIDTH, boardSize.height / TALENT_WORLD_HEIGHT) * 0.96, 0.28, 1);
}

function clampTalentView(view: TalentTreeViewState, boardSize: TalentBoardSize): TalentTreeViewState {
  if (boardSize.width <= 0 || boardSize.height <= 0) {
    return view;
  }
  const scaledWorldWidth = TALENT_WORLD_WIDTH * view.scale;
  const scaledWorldHeight = TALENT_WORLD_HEIGHT * view.scale;
  const maxX = Math.max(0, (scaledWorldWidth - boardSize.width) / 2 + TALENT_WORLD_PADDING);
  const maxY = Math.max(0, (scaledWorldHeight - boardSize.height) / 2 + TALENT_WORLD_PADDING);
  return {
    ...view,
    x: clamp(view.x, -maxX, maxX),
    y: clamp(view.y, -maxY, maxY),
  };
}

export function TalentTreeView({ nodes, activeTalentIds, selectedTalentId, canUseTalent, onSelectTalent }: TalentTreeViewProps) {
  const [view, setView] = useState<TalentTreeViewState>(initialView);
  const [boardSize, setBoardSize] = useState<TalentBoardSize>(initialBoardSize);
  const [dragging, setDragging] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const fitInitializedRef = useRef(false);
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

  const fitScale = fitScaleForBoard(boardSize);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) {
      return;
    }
    const updateSize = () => {
      setBoardSize({ width: board.clientWidth, height: board.clientHeight });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setView((current) => {
      if (!fitInitializedRef.current && boardSize.width > 0 && boardSize.height > 0) {
        fitInitializedRef.current = true;
        return clampTalentView({ x: 0, y: 0, scale: fitScale }, boardSize);
      }
      return clampTalentView({ ...current, scale: Math.max(current.scale, fitScale) }, boardSize);
    });
  }, [boardSize.height, boardSize.width, fitScale]);

  const adjustScale = (delta: number) => {
    setView((current) => clampTalentView({ ...current, scale: clamp(current.scale + delta, fitScale, 1.85) }, boardSize));
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
    setView((current) => clampTalentView({ ...current, x: current.x + dx, y: current.y + dy }, boardSize));
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
    "--talent-world-width": `${TALENT_WORLD_WIDTH}px`,
    "--talent-world-height": `${TALENT_WORLD_HEIGHT}px`,
    "--talent-tree-x": `${view.x}px`,
    "--talent-tree-y": `${view.y}px`,
    "--talent-tree-scale": view.scale,
  } as CSSProperties;

  return (
    <div
      aria-label="天賦盤"
      className={dragging ? "talent-board talent-board-dragging" : "talent-board"}
      ref={boardRef}
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
        <button aria-label={t("ui.control.reset")} onClick={() => setView(clampTalentView({ ...initialView, scale: fitScale }, boardSize))} title={t("ui.control.reset")} type="button">
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
