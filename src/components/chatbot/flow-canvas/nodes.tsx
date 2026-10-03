import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  MessageSquare, GitBranch, List, Type as TypeIcon, Plus,
  UserPlus, Ticket, UserCheck, CircleCheck, Split,
} from "lucide-react";
import type { CustomFlowItem, CustomFlowStep, CustomFlowBranch, FlowOutcome } from "../flow-types";
import { OUTCOME_LABELS } from "../flow-types";

const cardBase = "rounded-2xl bg-white shadow-[0_2px_10px_rgba(21,20,15,0.07)] border px-4 py-3 w-[252px]";

export function MenuNode({ data }: NodeProps) {
  const { menuIntro, optionCount } = data as { menuIntro: string; optionCount: number };
  return (
    <div className={`${cardBase} border-[#C7BFF0] bg-[#F3F0FF]`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-7 h-7 rounded-lg bg-[#6B4FE0] flex items-center justify-center shrink-0">
          <MessageSquare className="w-3.5 h-3.5 text-white" />
        </span>
        <p className="text-[13px] font-bold text-[#2A2240]">Main Menu</p>
      </div>
      <p className="text-[11.5px] text-[#6B6485] leading-snug line-clamp-2">{menuIntro || "How can we help you today?"}</p>
      <p className="text-[10.5px] text-[#8A82B0] mt-1.5 font-medium">{optionCount} option{optionCount === 1 ? "" : "s"}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-[#6B4FE0] !w-2 !h-2 !border-0" />
    </div>
  );
}

export function FlowOptionNode({ data }: NodeProps) {
  const { flow } = data as { flow: CustomFlowItem; index: number };
  return (
    <div className={`${cardBase} border-[#C7D8F0] bg-[#F0F5FF] cursor-pointer hover:shadow-[0_4px_16px_rgba(21,20,15,0.12)] transition-shadow`}>
      <Handle type="target" position={Position.Top} className="!bg-[#3B6FE0] !w-2 !h-2 !border-0" />
      <div className="flex items-center gap-2 mb-1">
        <span className="w-7 h-7 rounded-lg bg-[#3B6FE0] flex items-center justify-center shrink-0">
          <GitBranch className="w-3.5 h-3.5 text-white" />
        </span>
        <p className="text-[13px] font-bold text-[#1C2A52] truncate">{flow.label || "Untitled option"}</p>
      </div>
      <p className="text-[11px] text-[#6B7CA3]">{flow.steps.length} question{flow.steps.length === 1 ? "" : "s"}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-[#3B6FE0] !w-2 !h-2 !border-0" />
    </div>
  );
}

export function StepNode({ data }: NodeProps) {
  const { step } = data as { step: CustomFlowStep; flowIndex: number; stepIndex: number };
  const Icon = step.type === "text" ? TypeIcon : List;
  return (
    <div className={`${cardBase} border-[#BFE3DC] bg-[#F0FAF7] cursor-pointer hover:shadow-[0_4px_16px_rgba(21,20,15,0.12)] transition-shadow`}>
      <Handle type="target" position={Position.Top} className="!bg-[#1F9A82] !w-2 !h-2 !border-0" />
      <div className="flex items-center gap-2 mb-1">
        <span className="w-7 h-7 rounded-lg bg-[#1F9A82] flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-white" />
        </span>
        <p className="text-[12.5px] font-semibold text-[#133E35] line-clamp-2 leading-snug">{step.question || "Untitled question"}</p>
      </div>
      {step.saveAs && (
        <span className="inline-block text-[10px] font-mono font-medium text-[#1F9A82] bg-white px-1.5 py-0.5 rounded-full mt-1">
          saveAs: {step.saveAs}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-[#1F9A82] !w-2 !h-2 !border-0" />
    </div>
  );
}

export function AddStepNode({ data }: NodeProps) {
  void data;
  return (
    <div className="w-[252px] rounded-2xl border-2 border-dashed border-[#D9D7CC] bg-white/60 px-4 py-3 flex items-center justify-center gap-1.5 text-[#9A988D] hover:text-[#15140F] hover:border-[#15140F]/40 cursor-pointer transition-colors">
      <Handle type="target" position={Position.Top} className="!bg-[#D9D7CC] !w-2 !h-2 !border-0" />
      <Plus className="w-3.5 h-3.5" />
      <span className="text-[12px] font-medium">Add question</span>
    </div>
  );
}

export function AddFlowNode({ data }: NodeProps) {
  void data;
  return (
    <div className="w-[252px] rounded-2xl border-2 border-dashed border-[#D9D7CC] bg-white/60 px-4 py-3 flex items-center justify-center gap-1.5 text-[#9A988D] hover:text-[#15140F] hover:border-[#15140F]/40 cursor-pointer transition-colors">
      <Handle type="target" position={Position.Top} className="!bg-[#D9D7CC] !w-2 !h-2 !border-0" />
      <Plus className="w-3.5 h-3.5" />
      <span className="text-[12px] font-medium">Add menu option</span>
    </div>
  );
}

export function BranchNode({ data }: NodeProps) {
  const { branch } = data as { branch: CustomFlowBranch; flowIndex: number; branchIndex: number };
  return (
    <div className="w-[230px] rounded-2xl bg-[#FFF8EB] border border-[#EAD39B] shadow-[0_2px_10px_rgba(21,20,15,0.07)] px-4 py-3 cursor-pointer hover:shadow-[0_4px_16px_rgba(21,20,15,0.12)] transition-shadow">
      <Handle type="target" position={Position.Top} className="!bg-[#C99A3B] !w-2 !h-2 !border-0" />
      <div className="flex items-center gap-2 mb-1">
        <span className="w-6 h-6 rounded-lg bg-[#C99A3B] flex items-center justify-center shrink-0">
          <Split className="w-3 h-3 text-white" />
        </span>
        <p className="text-[11px] font-bold text-[#6B5420] uppercase tracking-wide">If</p>
      </div>
      <p className="text-[12px] text-[#5A4A1F] leading-snug">
        <span className="font-mono font-semibold">{branch.whenSaveAs || "field"}</span> = <span className="font-semibold">&quot;{branch.equals || "value"}&quot;</span>
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-[#C99A3B] !w-2 !h-2 !border-0" />
    </div>
  );
}

const OUTCOME_STYLE: Record<FlowOutcome, { bg: string; border: string; fg: string; icon: typeof CircleCheck }> = {
  NONE:           { bg: "#F3F2EE", border: "#E4E2D8", fg: "#454337", icon: CircleCheck },
  CREATE_LEAD:    { bg: "#EAF6EE", border: "#B7DFC2", fg: "#1F6B37", icon: UserPlus },
  CREATE_TICKET:  { bg: "#EAF1FC", border: "#B9CFEE", fg: "#1E4D8C", icon: Ticket },
  ASSIGN_AGENT:   { bg: "#F5EEFC", border: "#D4BFEE", fg: "#5B2E8C", icon: UserCheck },
};

export function OutcomeNode({ data }: NodeProps) {
  const { outcome, isDefault } = data as { outcome: FlowOutcome; isDefault?: boolean };
  const s = OUTCOME_STYLE[outcome] ?? OUTCOME_STYLE.NONE;
  const Icon = s.icon;
  return (
    <div className="w-[200px] rounded-2xl px-4 py-3 border" style={{ background: s.bg, borderColor: s.border }}>
      <Handle type="target" position={Position.Top} style={{ background: s.fg }} className="!w-2 !h-2 !border-0" />
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 shrink-0" style={{ color: s.fg }} />
        <p className="text-[12px] font-semibold" style={{ color: s.fg }}>{OUTCOME_LABELS[outcome]}</p>
      </div>
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
