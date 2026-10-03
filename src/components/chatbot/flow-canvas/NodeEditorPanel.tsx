import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Eye, X } from "lucide-react";
import type { CustomFlowItem, CustomFlowStep, CustomFlowBranch } from "../flow-types";

export type Selection =
  | { kind: "menu" }
  | { kind: "flow"; flowIndex: number }
  | { kind: "step"; flowIndex: number; stepIndex: number }
  | { kind: "branch"; flowIndex: number; branchIndex: number }
  | null;

interface Props {
  selection: Selection;
  onClose: () => void;
  menuIntro: string;
  setMenuIntro: (v: string) => void;
  flows: CustomFlowItem[];
  updateFlow: (i: number, patch: Partial<CustomFlowItem>) => void;
  removeFlow: (i: number) => void;
  addStep: (i: number) => void;
  updateStep: (i: number, si: number, patch: Partial<CustomFlowStep>) => void;
  removeStep: (i: number, si: number) => void;
  addBranch: (i: number) => void;
  updateBranch: (i: number, bi: number, patch: Partial<CustomFlowBranch>) => void;
  removeBranch: (i: number, bi: number) => void;
  onTestOption?: (label: string) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[#716F66]">{label}</label>
      {children}
    </div>
  );
}

// Floats over the canvas rather than sitting in the layout as a persistent
// column — it only exists while something is selected, so the canvas gets
// the full width back the instant you close it.
function PanelShell({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="absolute top-5 right-5 bottom-5 w-[300px] bg-white rounded-[18px] border border-[#F0EAD9] shadow-[0_18px_44px_rgba(80,65,30,0.14)] flex flex-col overflow-hidden z-10">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EAD9] shrink-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#B3B1A6]">{title}</p>
        <button onClick={onClose} aria-label="Close" className="text-[#9A988D] hover:text-[#15140F]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 space-y-4 overflow-y-auto flex-1">{children}</div>
      {footer && <div className="p-4 border-t border-[#F0EAD9] shrink-0">{footer}</div>}
    </div>
  );
}

export function NodeEditorPanel(props: Props) {
  const { selection, onClose, menuIntro, setMenuIntro, flows } = props;

  if (!selection) return null;

  if (selection.kind === "menu") {
    return (
      <PanelShell title="Main Menu" onClose={onClose}>
        <Field label="Intro message">
          <textarea
            className="w-full border border-[#ECEBE6] rounded-lg px-3 py-2 text-sm min-h-24 resize-none"
            value={menuIntro}
            onChange={(e) => setMenuIntro(e.target.value)}
            placeholder="How can we help you today?"
          />
        </Field>
        <p className="text-[11px] text-[#9A988D]">Shown above the menu buttons, right after the welcome message. Every option below becomes one of those buttons.</p>
      </PanelShell>
    );
  }

  if (selection.kind === "flow") {
    const f = flows[selection.flowIndex];
    if (!f) return null;
    const i = selection.flowIndex;
    return (
      <PanelShell
        title="Menu Option"
        onClose={onClose}
        footer={
          <button onClick={() => { props.removeFlow(i); onClose(); }} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />Delete this option
          </button>
        }
      >
          <Field label="Button label">
            <Input value={f.label} onChange={(e) => props.updateFlow(i, { label: e.target.value })} placeholder="e.g. 🏠 Book a Viewing" />
          </Field>

          <Field label="When finished (default)">
            <select className="w-full border border-[#ECEBE6] rounded-lg px-2 py-2 text-sm bg-white" value={f.outcome} onChange={(e) => props.updateFlow(i, { outcome: e.target.value as CustomFlowItem["outcome"] })}>
              <option value="NONE">Just show the closing message</option>
              <option value="CREATE_LEAD">Create a Lead</option>
              <option value="CREATE_TICKET">Create a Ticket</option>
              <option value="ASSIGN_AGENT">Hand off to an agent</option>
            </select>
          </Field>

          {f.outcome === "CREATE_LEAD" && (
            <div className="grid grid-cols-2 gap-2">
              <Input className="text-xs" placeholder="Lead type" value={f.leadType ?? ""} onChange={(e) => props.updateFlow(i, { leadType: e.target.value })} />
              <Input className="text-xs" type="number" min={0} max={100} placeholder="Score" value={f.leadScore ?? 60} onChange={(e) => props.updateFlow(i, { leadScore: Number(e.target.value) || 0 })} />
            </div>
          )}
          {f.outcome === "CREATE_TICKET" && (
            <Input className="text-xs" placeholder="Ticket subject" value={f.ticketSubject ?? ""} onChange={(e) => props.updateFlow(i, { ticketSubject: e.target.value })} />
          )}

          <Field label="Closing message">
            <textarea className="w-full border border-[#ECEBE6] rounded-lg px-3 py-2 text-xs min-h-20 resize-none" value={f.closingMessage} onChange={(e) => props.updateFlow(i, { closingMessage: e.target.value })} placeholder="Thanks! We'll be in touch shortly." />
          </Field>

          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => props.addStep(i)}><Plus className="w-3.5 h-3.5 mr-1.5" />Question</Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => props.addBranch(i)}><Plus className="w-3.5 h-3.5 mr-1.5" />Branch</Button>
          </div>
          {props.onTestOption && (
            <Button size="sm" variant="outline" className="w-full" onClick={() => props.onTestOption?.(f.label)}><Eye className="w-3.5 h-3.5 mr-1.5" />Test in Live Preview</Button>
          )}
      </PanelShell>
    );
  }

  if (selection.kind === "step") {
    const { flowIndex: i, stepIndex: si } = selection;
    const st = flows[i]?.steps[si];
    if (!st) return null;
    return (
      <PanelShell
        title={`Question ${si + 1}`}
        onClose={onClose}
        footer={
          <button onClick={() => { props.removeStep(i, si); onClose(); }} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />Delete this question
          </button>
        }
      >
          <Field label="Question text">
            <textarea className="w-full border border-[#ECEBE6] rounded-lg px-3 py-2 text-sm min-h-16 resize-none" value={st.question} onChange={(e) => props.updateStep(i, si, { question: e.target.value })} placeholder="e.g. Which city are you in?" />
          </Field>

          <Field label="Answer type">
            <select className="w-full border border-[#ECEBE6] rounded-lg px-2 py-2 text-sm bg-white" value={st.type} onChange={(e) => props.updateStep(i, si, { type: e.target.value as "choice" | "text" })}>
              <option value="choice">Multiple choice</option>
              <option value="text">Free text</option>
            </select>
          </Field>

          <Field label="Save answer as">
            <Input className="text-xs font-mono" placeholder="e.g. city" value={st.saveAs} onChange={(e) => props.updateStep(i, si, { saveAs: e.target.value.replace(/\s+/g, "_") })} />
          </Field>

          {st.type === "text" && (
            <Field label="Answer format">
              <select className="w-full border border-[#ECEBE6] rounded-lg px-2 py-2 text-sm bg-white" value={st.validate ?? "none"} onChange={(e) => props.updateStep(i, si, { validate: e.target.value as CustomFlowStep["validate"] })}>
                <option value="none">Any answer</option>
                <option value="phone">Phone number</option>
                <option value="email">Email address</option>
                <option value="number">Number</option>
              </select>
            </Field>
          )}

          {st.type === "choice" && (
            <>
              <Field label="Options source">
                <select className="w-full border border-[#ECEBE6] rounded-lg px-2 py-2 text-sm bg-white" value={st.optionsSource ?? "manual"} onChange={(e) => props.updateStep(i, si, { optionsSource: e.target.value as CustomFlowStep["optionsSource"] })}>
                  <option value="manual">Manual options (typed below)</option>
                  <option value="vehicles">My active Vehicles (Catalog tab)</option>
                  <option value="offers">My active Offers (Catalog tab)</option>
                </select>
              </Field>
              {(st.optionsSource ?? "manual") === "manual" ? (
                <Field label="Options (comma separated)">
                  <Input className="text-xs" placeholder="e.g. Mumbai, Delhi, Chennai" value={st.options.join(", ")} onChange={(e) => props.updateStep(i, si, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })} />
                </Field>
              ) : (
                <p className="text-[11px] text-[#9A988D]">Options are pulled live from your {st.optionsSource === "vehicles" ? "active Vehicles" : "active Offers"}.</p>
              )}
            </>
          )}
      </PanelShell>
    );
  }

  // branch
  const { flowIndex: i, branchIndex: bi } = selection;
  const b = flows[i]?.branches?.[bi];
  if (!b) return null;
  return (
    <PanelShell
      title="Branch condition"
      onClose={onClose}
      footer={
        <button onClick={() => { props.removeBranch(i, bi); onClose(); }} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1.5">
          <Trash2 className="w-3.5 h-3.5" />Delete this branch
        </button>
      }
    >
        <p className="text-[11px] text-[#9A988D]">Give a different outcome depending on one earlier answer. First matching branch wins.</p>
        <Field label="When saveAs field">
          <Input className="text-xs font-mono" placeholder="e.g. interest" value={b.whenSaveAs} onChange={(e) => props.updateBranch(i, bi, { whenSaveAs: e.target.value.replace(/\s+/g, "_") })} />
        </Field>
        <Field label="Equals value">
          <Input className="text-xs" placeholder="e.g. Test Drive" value={b.equals} onChange={(e) => props.updateBranch(i, bi, { equals: e.target.value })} />
        </Field>
        <Field label="Outcome">
          <select className="w-full border border-[#ECEBE6] rounded-lg px-2 py-2 text-sm bg-white" value={b.outcome} onChange={(e) => props.updateBranch(i, bi, { outcome: e.target.value as CustomFlowBranch["outcome"] })}>
            <option value="NONE">Just show the message</option>
            <option value="CREATE_LEAD">Create a Lead</option>
            <option value="CREATE_TICKET">Create a Ticket</option>
            <option value="ASSIGN_AGENT">Hand off to an agent</option>
          </select>
        </Field>
        {b.outcome === "CREATE_LEAD" && (
          <div className="grid grid-cols-2 gap-2">
            <Input className="text-xs" placeholder="Lead type" value={b.leadType ?? ""} onChange={(e) => props.updateBranch(i, bi, { leadType: e.target.value })} />
            <Input className="text-xs" type="number" min={0} max={100} placeholder="Score" value={b.leadScore ?? 60} onChange={(e) => props.updateBranch(i, bi, { leadScore: Number(e.target.value) || 0 })} />
          </div>
        )}
        {b.outcome === "CREATE_TICKET" && (
          <Input className="text-xs" placeholder="Ticket subject" value={b.ticketSubject ?? ""} onChange={(e) => props.updateBranch(i, bi, { ticketSubject: e.target.value })} />
        )}
        <Field label="Closing message">
          <textarea className="w-full border border-[#ECEBE6] rounded-lg px-3 py-2 text-xs min-h-20 resize-none" value={b.closingMessage} onChange={(e) => props.updateBranch(i, bi, { closingMessage: e.target.value })} placeholder="Closing message for this branch…" />
        </Field>
    </PanelShell>
  );
}
