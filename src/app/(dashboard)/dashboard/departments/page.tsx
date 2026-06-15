"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Plus, Building2, Trash2, Users } from "lucide-react";

export default function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: () => axios.get("/api/departments").then((r) => r.data.data),
  });

  const create = useMutation({
    mutationFn: (body: { name: string; description: string }) => axios.post("/api/departments", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setOpen(false);
      setName("");
      setDescription("");
      toast({ title: "Department created" });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to create department";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const deleteDept = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast({ title: "Department deleted" });
    },
  });

  const departments = data || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="text-muted-foreground">Organize your team into departments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Department</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Department</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate({ name, description });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales, Support, Engineering" required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
              </div>
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
      ) : departments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No departments yet. Create your first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept: { _id: string; name: string; description?: string; isActive: boolean; agents?: string[] }) => (
            <Card key={dept._id} className="relative group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{dept.name}</CardTitle>
                      {dept.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{dept.description}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                    onClick={() => deleteDept.mutate(dept._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{dept.agents?.length || 0} agents</span>
                  </div>
                  <Badge variant={dept.isActive ? "active" : "inactive"}>
                    {dept.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
