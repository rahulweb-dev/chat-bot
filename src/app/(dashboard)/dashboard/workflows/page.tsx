"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Plus, Zap, Trash2, ArrowRight } from "lucide-react";

const TRIGGER_LABELS: Record<string, string> = {
  NEW_CONVERSATION: "New conversation started",
  TICKET_CREATED: "Ticket created",
  LEAD_CREATED: "Lead created",
  STATUS_CHANGED: "Status changed",
  KEYWORD_MATCHED: "Keyword matched",
  IDLE_TIMEOUT: "Chat idle timeout",
};

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("NEW_CONVERSATION");

  const { data, isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => axios.get("/api/workflows").then((r) => r.data.data),
  });

  const create = useMutation({
    mutationFn: (body: unknown) => axios.post("/api/workflows", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setOpen(false);
      setName("");
      toast({ title: "Workflow created" });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to create workflow";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      axios.patch(`/api/workflows/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to update workflow";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const deleteWorkflow = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/workflows/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast({ title: "Workflow deleted" });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to delete workflow";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const workflows = data || [];

  return (
    <div className="p-6 space-y-6 ">
      <div className="flex items-center justify-between ">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-muted-foreground">Automate repetitive tasks with trigger-based workflows</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2 " />New Workflow</Button>
          </DialogTrigger>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle >Create Workflow</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate({ name, trigger, actions: [], isActive: true });
              }}
              className="space-y-4 "
            >
              <div className="space-y-2">
                <Label>Workflow Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome New Customers" required />
              </div>
              <div className="space-y-2">
                <Label>Trigger</Label>
                <Select value={trigger} onValueChange={setTrigger}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                You can add actions to this workflow after creation.
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No workflows yet</p>
            <p className="text-sm text-muted-foreground mt-1">Automate your support processes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {workflows.map((wf: {
            _id: string;
            name: string;
            trigger: string;
            isActive: boolean;
            actions: { type: string }[];
            executionCount?: number;
          }) => {
            const isToggling = toggle.isPending && toggle.variables?.id === wf._id;
            return (
            <Card key={wf._id} className="group">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{wf.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{TRIGGER_LABELS[wf.trigger] || wf.trigger}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground">{wf.executionCount || 0} runs</div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={wf.isActive}
                      aria-label={wf.isActive ? "Deactivate workflow" : "Activate workflow"}
                      disabled={isToggling}
                      onClick={() => toggle.mutate({ id: wf._id, isActive: !wf.isActive })}
                      className={`
                        inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border
                        transition-colors duration-200 shadow-sm
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-400
                        disabled:cursor-not-allowed disabled:opacity-60
                        ${isToggling ? "cursor-wait" : "cursor-pointer"}
                        ${wf.isActive
                          ? "bg-emerald-50 border-emerald-200 hover:border-emerald-300"
                          : "bg-rose-50/70 border-rose-200/80 hover:border-rose-300"
                        }
                      `}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-200 ${wf.isActive ? "bg-emerald-500" : "bg-rose-400"}`} />
                      <span className={`text-[11px] font-medium tracking-wide transition-colors duration-200 w-12 text-left ${wf.isActive ? "text-emerald-700" : "text-rose-500"}`}>
                        {isToggling ? "…" : wf.isActive ? "Active" : "Inactive"}
                      </span>
                      <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full ml-0.5 transition-colors duration-200 ${wf.isActive ? "bg-emerald-500" : "bg-gray-300"}`}>
                        <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ease-out ${wf.isActive ? "translate-x-3.5" : "translate-x-0.5"}`} />
                      </span>
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${wf.name}`}
                          className="h-8 w-8 text-destructive hover:text-destructive opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {wf.name}?</AlertDialogTitle>
                          <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteWorkflow.mutate(wf._id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    WHEN: {TRIGGER_LABELS[wf.trigger] || wf.trigger}
                  </Badge>
                  {wf.actions.length > 0 && (
                    <>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      {wf.actions.map((action, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {action.type}
                        </Badge>
                      ))}
                    </>
                  )}
                  {wf.actions.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No actions configured yet</span>
                  )}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
