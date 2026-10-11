"use client";

import {
  Controls,
  type Edge,
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type NodeTypes,
  ReactFlow,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./explore-flow.css";

export type ExploreCamera = Viewport | undefined;

/** React Flow owns gestures, keyboard selection, hit areas, and viewport controls. */
export function ExploreFlow<N extends Node, E extends Edge>({
  nodes,
  edges,
  nodeTypes,
  width,
  camera,
  onCamera,
  onSelect,
  onSelectEdge,
  onDeselect,
  label,
  initialVisibleCount,
}: {
  nodes: N[];
  edges: E[];
  nodeTypes: NodeTypes;
  width: number;
  camera: ExploreCamera;
  onCamera(camera: Viewport): void;
  onSelect(node: N): void;
  onSelectEdge?(edge: E): void;
  onDeselect?(): void;
  label: string;
  initialVisibleCount?: number;
}) {
  const height = width < 640 ? 400 : 520;
  const initial = getViewportForBounds(
    getNodesBounds(
      initialVisibleCount ? nodes.slice(0, initialVisibleCount) : nodes,
    ),
    width,
    height,
    initialVisibleCount ? 0.85 : 0.25,
    1,
    0.15,
  );
  return (
    <div className="explore-flow" style={{ height }}>
      <ReactFlow<N, E>
        aria-label={label}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        viewport={camera ?? initial}
        onViewportChange={onCamera}
        onNodeClick={(_event, node) => onSelect(node)}
        onEdgeClick={(_event, edge) => onSelectEdge?.(edge)}
        onPaneClick={onDeselect}
        onKeyDown={(event) => {
          if (event.key === "Escape") onDeselect?.();
        }}
        onNodesChange={(changes) => {
          for (const change of changes) {
            if (change.type === "select" && change.selected) {
              const node = nodes.find((item) => item.id === change.id);
              if (node) onSelect(node);
            }
          }
        }}
        onEdgesChange={(changes) => {
          for (const change of changes) {
            if (change.type === "select" && change.selected) {
              const edge = edges.find((item) => item.id === change.id);
              if (edge) onSelectEdge?.(edge);
            }
          }
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        deleteKeyCode={null}
        minZoom={0.25}
        maxZoom={2}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        ariaLabelConfig={{
          "controls.fitView.ariaLabel": "Fit map",
          "controls.zoomIn.ariaLabel": "Zoom in",
          "controls.zoomOut.ariaLabel": "Zoom out",
          "node.a11yDescription.default":
            "Press Enter or Space to read context. Press Escape to deselect.",
        }}
      >
        <Controls
          showInteractive={false}
          orientation="horizontal"
          position="bottom-right"
        />
      </ReactFlow>
    </div>
  );
}
