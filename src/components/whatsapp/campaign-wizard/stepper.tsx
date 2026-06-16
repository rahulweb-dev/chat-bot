"use client";

import { FileEdit, Users, FlaskConical, CalendarClock, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEPS = [
  { id: 1, label: "Campaign Details", icon: FileEdit },
  { id: 2, label: "User Recipients", icon: Users },
  { id: 3, label: "Test", icon: FlaskConical },
  { id: 4, label: "Schedule", icon: CalendarClock },
] as const;

export function Stepper({
  current,
  furthestUnlocked,
  onStepClick,
}: {
  current: number;
  furthestUnlocked: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="flex items-center w-full">
      {STEPS.map((step, i) => {
        const isActive = step.id === current;
        const isDone = step.id < current;
        const isLocked = step.id > furthestUnlocked;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              disabled={isLocked}
              onClick={() => onStepClick(step.id)}
              className={cn(
                "flex items-center gap-2.5 group",
                isLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors",
                  isActive ? "bg-orange-500 border-orange-500 text-white" :
                  isDone ? "bg-blue-600 border-blue-600 text-white" :
                  "bg-white border-gray-300 text-gray-400"
                )}
              >
                {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <div className="text-left hidden sm:block">
                <p className={cn("text-xs font-medium leading-tight", isActive ? "text-orange-600" : isDone ? "text-blue-700" : "text-gray-500")}>
                  Step {step.id}
                </p>
                <p className={cn("text-sm font-semibold leading-tight", isActive || isDone ? "text-gray-900" : "text-gray-400")}>
                  {step.label}
                </p>
              </div>
            </button>
            {i < STEPS.length - 1 && (
              <div className={cn("h-0.5 flex-1 mx-3 rounded", step.id < current ? "bg-blue-600" : "bg-gray-200")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
