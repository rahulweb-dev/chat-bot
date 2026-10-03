"use client";
import { useMemo, useState, useCallback, useEffect } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap,
  useNodesState, useEdgesState, type Node, type NodeMouseHandler, type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { buildGraph } from "./layout";
import { nodeTypes } from "./nodes";
import { NodeEditorPanel, type Selection } from "./NodeEditorPanel";
import type { CustomFlowItem, CustomFlowStep, CustomFlowBranch } from "../flow-types";

interface FlowCanvasProps {
  menuIntro: string;
  setMenuIntro: (v: string) => void;
  flows: CustomFlowItem[];
  updateFlow: (i: number, patch: Partial<CustomFlowItem>) => void;
  removeFlow: (i: number) => void;
  addFlow: () => void;
  addStep: (i: number) => void;
  updateStep: (i: number, si: number, patch: Partial<CustomFlowStep>) => void;
  removeStep: (i: number, si: number) => void;
  addBranch: (i: number) => void;
  updateBranch: (i: number, bi: number, patch: Partial<CustomFlowBranch>) => void;
  removeBranch: (i: number, bi: number) => void;
  onTestOption?: (label: string) => void;
  // True on the dedicated full-screen Menu Flow page, where there's no rail/
  // live-preview column competing for space and the canvas should claim the
  // whole viewport below the page header instead of the capped embedded size.
  fullHeight?: boolean;
}

function parseId(id: string): Selection {
  if (id === "menu") return { kind: "menu" };
  let m = id.match(/^flow-(\d+)$/);
  if (m) return { kind: "flow", flowIndex: Number(m[1]) };
  m = id.match(/^step-(\d+)-(\d+)$/);
  if (m) return { kind: "step", flowIndex: Number(m[1]), stepIndex: Number(m[2]) };
  m = id.match(/^branch-(\d+)-(\d+)$/);
  if (m) return { kind: "branch", flowIndex: Number(m[1]), branchIndex: Number(m[2]) };
  return null;
}

function FlowCanvasInner(props: FlowCanvasProps) {
  const { menuIntro, flows } = props;
  const graph = useMemo(() => buildGraph(menuIntro, flows), [menuIntro, flows]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
  const [selection, setSelection] = useState<Selection>(null);

  // Rebuild whenever the underlying data changes (every edit in the side
  // panel flows back through `flows`/`menuIntro`) — selection is tracked
  // separately by id, so it survives a rebuild.
  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.id === "addflow") { props.addFlow(); return; }
    const addStepMatch = node.id.match(/^addstep-(\d+)$/);
    if (addStepMatch) { props.addStep(Number(addStepMatch[1])); return; }
    setSelection(parseId(node.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.addFlow, props.addStep]);

  const handleNodeDragStop: OnNodeDrag<Node> = useCallback((_event, node) => {
    const flowMatch = node.id.match(/^flow-(\d+)$/);
    if (flowMatch) { props.updateFlow(Number(flowMatch[1]), { position: node.position }); return; }
    const stepMatch = node.id.match(/^step-(\d+)-(\d+)$/);
    if (stepMatch) { props.updateStep(Number(stepMatch[1]), Number(stepMatch[2]), { position: node.position }); return; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.updateFlow, props.updateStep]);

  return (
    <div className={props.fullHeight
      ? "relative h-[calc(100vh-190px)] min-h-[600px] rounded-[24px] border border-[#F0EAD9] overflow-hidden bg-[#FAF6EC]"
      : "relative h-[calc(100vh-260px)] min-h-[600px] max-h-[900px] rounded-[24px] border border-[#F0EAD9] overflow-hidden bg-[#FAF6EC]"
    }>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#EFE7D4" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor="#fff"
          nodeStrokeColor="#E7DFC9"
          nodeStrokeWidth={2}
          maskColor="rgba(250,246,236,0.75)"
          className="!bg-white !border !border-[#F0EAD9] !rounded-xl !shadow-[0_4px_14px_rgba(80,65,30,0.08)] !bottom-4 !right-4"
        />
      </ReactFlow>
      {selection && (
        <NodeEditorPanel
          selection={selection}
          onClose={() => setSelection(null)}
          menuIntro={props.menuIntro}
          setMenuIntro={props.setMenuIntro}
          flows={props.flows}
          updateFlow={props.updateFlow}
          removeFlow={props.removeFlow}
          addStep={props.addStep}
          updateStep={props.updateStep}
          removeStep={props.removeStep}
          addBranch={props.addBranch}
          updateBranch={props.updateBranch}
          removeBranch={props.removeBranch}
          onTestOption={props.onTestOption}
        />
      )}
    </div>
  );
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
