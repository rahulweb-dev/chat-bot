import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  MessageSquare, GitBranch, List, Type as TypeIcon, Plus, Split,
} from "lucide-react";
import type { CustomFlowItem, CustomFlowStep, CustomFlowBranch, FlowOutcome } from "../flow-types";
import { OUTCOME_LABELS } from "../flow-types";

// White cards with a colored icon chip, not a tinted card background — the
// chip alone carries each node kind's color, so the canvas reads calmer at a
// glance and the warm paper background shows through around every card.
const cardBase = "rounded-[20px] bg-white shadow-[0_2px_10px_rgba(80,65,30,0.05)] border border-[#F0EAD9] px-[18px] py-4 w-[270px] flex items-center gap-3";

export function MenuNode({ data }: NodeProps) {
  const { menuIntro, optionCount } = data as { menuIntro: string; optionCount: number };
  return (
    <div className={cardBase}>
      <span className="w-[34px] h-[34px] rounded-[11px] bg-[#F3F0FF] flex items-center justify-center shrink-0">
        <MessageSquare className="w-4 h-4 text-[#6B4FE0]" />
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-bold text-[#15140F]">Main Menu</p>
        <p className="text-[11px] text-[#9A988D] truncate">{menuIntro || "How can we help you today?"} · {optionCount} option{optionCount === 1 ? "" : "s"}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-[#6B4FE0] !w-2 !h-2 !border-0" />
    </div>
  );
}

export function FlowOptionNode({ data }: NodeProps) {
  const { flow } = data as { flow: CustomFlowItem; index: number };
  return (
    <div className={`${cardBase} cursor-pointer hover:shadow-[0_6px_18px_rgba(80,65,30,0.1)] hover:border-[#E7DFC9] transition-shadow`}>
      <Handle type="target" position={Position.Top} className="!bg-[#3B6FE0] !w-2 !h-2 !border-0" />
      <span className="w-[34px] h-[34px] rounded-[11px] bg-[#E8F0FF] flex items-center justify-center shrink-0">
        <GitBranch className="w-4 h-4 text-[#3B6FE0]" />
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-bold text-[#15140F] truncate">{flow.label || "Untitled option"}</p>
        <p className="text-[11px] text-[#9A988D]">{flow.steps.length} question{flow.steps.length === 1 ? "" : "s"}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-[#3B6FE0] !w-2 !h-2 !border-0" />
    </div>
  );
}

export function StepNode({ data }: NodeProps) {
  const { step } = data as { step: CustomFlowStep; flowIndex: number; stepIndex: number };
  const Icon = step.type === "text" ? TypeIcon : List;
  return (
    <div className={`${cardBase} cursor-pointer hover:shadow-[0_6px_18px_rgba(80,65,30,0.1)] hover:border-[#E7DFC9] transition-shadow`}>
      <Handle type="target" position={Position.Top} className="!bg-[#1F9A82] !w-2 !h-2 !border-0" />
      <span className="w-[34px] h-[34px] rounded-[11px] bg-[#E7F7F1] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#1F9A82]" />
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-[#15140F] line-clamp-2 leading-snug">{step.question || "Untitled question"}</p>
        {step.saveAs && (
          <span className="inline-block text-[10px] font-mono font-medium text-[#1F9A82] mt-0.5">
            saveAs: {step.saveAs}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-[#1F9A82] !w-2 !h-2 !border-0" />
    </div>
  );
}

export function AddStepNode({ data }: NodeProps) {
  void data;
  return (
    <div className="w-[270px] rounded-[20px] border-2 border-dashed border-[#E7DFC9] bg-white/50 px-[18px] py-4 flex items-center justify-center gap-1.5 text-[#B3B1A6] hover:text-[#15140F] hover:border-[#15140F]/30 cursor-pointer transition-colors">
      <Handle type="target" position={Position.Top} className="!bg-[#E7DFC9] !w-2 !h-2 !border-0" />
      <Plus className="w-3.5 h-3.5" />
      <span className="text-[12px] font-medium">Add question</span>
    </div>
  );
}

export function AddFlowNode({ data }: NodeProps) {
  void data;
  return (
    <div className="w-[270px] rounded-[20px] border-2 border-dashed border-[#E7DFC9] bg-white/50 px-[18px] py-4 flex items-center justify-center gap-1.5 text-[#B3B1A6] hover:text-[#15140F] hover:border-[#15140F]/30 cursor-pointer transition-colors">
      <Handle type="target" position={Position.Top} className="!bg-[#E7DFC9] !w-2 !h-2 !border-0" />
      <Plus className="w-3.5 h-3.5" />
      <span className="text-[12px] font-medium">Add menu option</span>
    </div>
  );
}

export function BranchNode({ data }: NodeProps) {
  const { branch } = data as { branch: CustomFlowBranch; flowIndex: number; branchIndex: number };
  return (
    <div className="w-[250px] rounded-[20px] bg-white border border-[#F0EAD9] shadow-[0_2px_10px_rgba(80,65,30,0.05)] px-[18px] py-4 flex items-center gap-3 cursor-pointer hover:shadow-[0_6px_18px_rgba(80,65,30,0.1)] hover:border-[#E7DFC9] transition-shadow">
      <Handle type="target" position={Position.Top} className="!bg-[#C99A3B] !w-2 !h-2 !border-0" />
      <span className="w-[34px] h-[34px] rounded-[11px] bg-[#FBF1D9] flex items-center justify-center shrink-0">
        <Split className="w-4 h-4 text-[#B3831F]" />
      </span>
      <div className="min-w-0">
        <p className="text-[10.5px] font-bold text-[#B3831F] uppercase tracking-wide">If</p>
        <p className="text-[12px] text-[#15140F] leading-snug truncate">
          <span className="font-mono font-semibold">{branch.whenSaveAs || "field"}</span> = &quot;{branch.equals || "value"}&quot;
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-[#C99A3B] !w-2 !h-2 !border-0" />
    </div>
  );
}

const OUTCOME_STYLE: Record<FlowOutcome, { bg: string; border: string; fg: string }> = {
  NONE:           { bg: "#F3F2EE", border: "#E4E2D8", fg: "#716F66" },
  CREATE_LEAD:    { bg: "#F0F8F2", border: "#D6EBDA", fg: "#2C7A4B" },
  CREATE_TICKET:  { bg: "#EEF4FC", border: "#D3E3F7", fg: "#2A5C9C" },
  ASSIGN_AGENT:   { bg: "#F6F0FC", border: "#E3D3F5", fg: "#6B3E9C" },
};

export function OutcomeNode({ data }: NodeProps) {
  const { outcome, isDefault } = data as { outcome: FlowOutcome; isDefault?: boolean };
  const s = OUTCOME_STYLE[outcome] ?? OUTCOME_STYLE.NONE;
  return (
    <div className="w-[230px] rounded-[20px] px-[18px] py-3.5 border text-center" style={{ background: s.bg, borderColor: s.border }}>
      <Handle type="target" position={Position.Top} style={{ background: s.fg }} className="!w-2 !h-2 !border-0" />
      <p className="text-[12.5px] font-semibold" style={{ color: s.fg }}>✓ {OUTCOME_LABELS[outcome]}</p>
      {isDefault && <p className="text-[10px] mt-1 opacity-70" style={{ color: s.fg }}>default outcome</p>}
    </div>
  );
}

export const nodeTypes = {
  menu: MenuNode,
  flowOption: FlowOptionNode,
  step: StepNode,
  addStep: AddStepNode,
  addFlow: AddFlowNode,
  branch: BranchNode,
  outcome: OutcomeNode,
};
