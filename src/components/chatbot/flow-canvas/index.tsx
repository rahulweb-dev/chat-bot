"use client";
import { useMemo, useState, useCallback, useEffect } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls,
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
    <div className="flex h-[640px] rounded-2xl border border-[#ECEBE6] overflow-hidden bg-[#FAFAF8]">
      <div className="flex-1 min-w-0">
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
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#E4E2D8" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
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
