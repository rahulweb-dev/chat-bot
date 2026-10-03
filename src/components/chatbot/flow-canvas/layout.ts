import type { Node, Edge } from "@xyflow/react";
import type { CustomFlowItem } from "../flow-types";

// This isn't a free-form graph — it's always Menu → (per option) a linear
// chain of steps → branches/outcome. Auto-layout exploits that fixed shape
// instead of needing a general graph-layout library (dagre/elk): one
// horizontal "lane" per menu option, steps stacked down the lane, branches
// fanning out at the bottom. A node keeps its last dragged position
// (CustomFlowStep/Item.position) across re-layouts; only new/never-dragged
// nodes get an auto position.

const LANE_WIDTH = 300;
const ROW_HEIGHT = 136;
const MENU_Y = 0;
const FLOW_Y = MENU_Y + ROW_HEIGHT;
const STEP_Y0 = FLOW_Y + ROW_HEIGHT;

export interface BuildGraphResult {
  nodes: Node[];
  edges: Edge[];
}

export function buildGraph(menuIntro: string, flows: CustomFlowItem[]): BuildGraphResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const menuX = flows.length ? ((flows.length - 1) * LANE_WIDTH) / 2 : 0;
  nodes.push({
    id: "menu",
    type: "menu",
    position: { x: menuX, y: MENU_Y },
    data: { menuIntro, optionCount: flows.length },
    draggable: false,
  });

  flows.forEach((flow, fi) => {
    const laneX = fi * LANE_WIDTH;
    const flowPos = flow.position ?? { x: laneX, y: FLOW_Y };
    const flowNodeId = `flow-${fi}`;

    nodes.push({
      id: flowNodeId,
      type: "flowOption",
      position: flowPos,
      data: { flow, index: fi },
    });
    edges.push({
      id: `e-menu-${flowNodeId}`,
      source: "menu",
      target: flowNodeId,
      type: "smoothstep",
      style: { stroke: "#D9D7CC" },
    });

    let prevNodeId = flowNodeId;
    let y = STEP_Y0;
    flow.steps.forEach((step, si) => {
      const stepId = `step-${fi}-${si}`;
      const pos = step.position ?? { x: laneX, y };
      nodes.push({
        id: stepId,
        type: "step",
        position: pos,
        data: { step, flowIndex: fi, stepIndex: si, isLast: si === flow.steps.length - 1 },
      });
      edges.push({
        id: `e-${prevNodeId}-${stepId}`,
        source: prevNodeId,
        target: stepId,
        type: "smoothstep",
        style: { stroke: "#D9D7CC" },
      });
      prevNodeId = stepId;
      y += ROW_HEIGHT;
    });

    // Ghost "add question" node at the end of the chain
    const addStepId = `addstep-${fi}`;
    nodes.push({
      id: addStepId,
      type: "addStep",
      position: { x: laneX, y },
      data: { flowIndex: fi },
      draggable: false,
    });
    edges.push({
      id: `e-${prevNodeId}-${addStepId}`,
      source: prevNodeId,
      target: addStepId,
      type: "smoothstep",
      style: { stroke: "#E4E2D8", strokeDasharray: "4 4" },
    });
    y += ROW_HEIGHT;

    const branches = flow.branches ?? [];
    if (branches.length) {
      const branchSpan = (branches.length - 1) * (LANE_WIDTH * 0.62);
      const branchX0 = laneX - branchSpan / 2;
      branches.forEach((branch, bi) => {
        const branchId = `branch-${fi}-${bi}`;
        const bx = branchX0 + bi * (LANE_WIDTH * 0.62);
        nodes.push({
          id: branchId,
          type: "branch",
          position: { x: bx, y },
          data: { branch, flowIndex: fi, branchIndex: bi },
        });
        edges.push({ id: `e-${prevNodeId}-${branchId}`, source: prevNodeId, target: branchId, type: "smoothstep", style: { stroke: "#E8C98A" } });

        const outcomeId = `outcome-${fi}-b${bi}`;
        nodes.push({
          id: outcomeId,
          type: "outcome",
          position: { x: bx, y: y + ROW_HEIGHT },
          data: { outcome: branch.outcome },
          draggable: false,
        });
        edges.push({ id: `e-${branchId}-${outcomeId}`, source: branchId, target: outcomeId, type: "smoothstep", style: { stroke: "#E8C98A" } });
      });
      // Default outcome (no branch matched) sits center, one row below the branches
      const defaultOutcomeId = `outcome-${fi}-default`;
      nodes.push({
        id: defaultOutcomeId,
        type: "outcome",
        position: { x: laneX, y: y + ROW_HEIGHT * 2 },
        data: { outcome: flow.outcome, isDefault: true },
        draggable: false,
      });
      edges.push({ id: `e-${prevNodeId}-${defaultOutcomeId}`, source: prevNodeId, target: defaultOutcomeId, type: "smoothstep", style: { stroke: "#D9D7CC", strokeDasharray: "4 4" } });
    } else {
      const outcomeId = `outcome-${fi}-default`;
      nodes.push({
        id: outcomeId,
        type: "outcome",
        position: { x: laneX, y },
        data: { outcome: flow.outcome, isDefault: true },
        draggable: false,
      });
      edges.push({ id: `e-${prevNodeId}-${outcomeId}`, source: prevNodeId, target: outcomeId, type: "smoothstep", style: { stroke: "#D9D7CC" } });
    }
  });

  // Ghost "add option" node beside the last lane, hung off the menu
  const addFlowX = flows.length * LANE_WIDTH;
  nodes.push({
    id: "addflow",
    type: "addFlow",
    position: { x: addFlowX, y: FLOW_Y },
    data: {},
    draggable: false,
  });
  edges.push({ id: "e-menu-addflow", source: "menu", target: "addflow", type: "smoothstep", style: { stroke: "#E4E2D8", strokeDasharray: "4 4" } });

  return { nodes, edges };
}
