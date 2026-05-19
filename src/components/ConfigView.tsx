import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  useDailyTask,
  useSaveDailyTask,
  useSaveStickerSettings,
  useStickerSettings,
} from "../hooks/useDailyTask";
import type { StickerCorner } from "../lib/tauri";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

type TaskRow = {
  key: string;
  content: string;
};

function newTaskRow(key: string, content = ""): TaskRow {
  return { key, content };
}

const autosaveDelay = 450;

const cornerOptions: Array<{
  value: StickerCorner;
  label: string;
  markerClassName: string;
  tintClassName: string;
}> = [
  {
    value: "top-left",
    label: "Top left",
    markerClassName: "left-1 top-1 bg-sky-500",
    tintClassName: "hover:border-sky-400 hover:bg-sky-50",
  },
  {
    value: "top-right",
    label: "Top right",
    markerClassName: "right-1 top-1 bg-emerald-500",
    tintClassName: "hover:border-emerald-400 hover:bg-emerald-50",
  },
  {
    value: "bottom-left",
    label: "Bottom left",
    markerClassName: "bottom-1 left-1 bg-amber-500",
    tintClassName: "hover:border-amber-400 hover:bg-amber-50",
  },
  {
    value: "bottom-right",
    label: "Bottom right",
    markerClassName: "bottom-1 right-1 bg-rose-500",
    tintClassName: "hover:border-rose-400 hover:bg-rose-50",
  },
];

export function ConfigView() {
  const taskQuery = useDailyTask();
  const settingsQuery = useStickerSettings();
  const saveTask = useSaveDailyTask();
  const saveSettings = useSaveStickerSettings();
  const nextRowId = useRef(0);
  const taskSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydratedTasks = useRef(false);
  const lastSavedTaskSignature = useRef("");
  const [taskRows, setTaskRows] = useState<TaskRow[]>([newTaskRow("new-0")]);
  const [corner, setCorner] = useState<StickerCorner>("top-right");
  const trimmedContents = taskRows.map((taskRow) => taskRow.content.trim()).filter(Boolean);
  const taskSignature = trimmedContents.join("\n");

  useEffect(() => {
    if (taskQuery.data && !hasHydratedTasks.current) {
      setTaskRows(taskQuery.data.map((task) => newTaskRow(`task-${task.id}`, task.content)));
      lastSavedTaskSignature.current = taskQuery.data
        .map((task) => task.content.trim())
        .filter(Boolean)
        .join("\n");
      hasHydratedTasks.current = true;
    }
  }, [taskQuery.data]);

  useEffect(() => {
    if (settingsQuery.data) {
      setCorner(settingsQuery.data.corner);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!hasHydratedTasks.current) {
      return;
    }

    if (trimmedContents.length === 0 || taskSignature === lastSavedTaskSignature.current) {
      return;
    }

    const timer = setTimeout(() => {
      lastSavedTaskSignature.current = taskSignature;
      saveTask.mutate({ contents: trimmedContents });
    }, autosaveDelay);
    taskSaveTimer.current = timer;

    return () => {
      clearTimeout(timer);
    };
  }, [saveTask, taskSignature, trimmedContents]);

  const isSaving = saveTask.isPending || saveSettings.isPending;
  const saved = saveTask.isSuccess || saveSettings.isSuccess;

  return (
    <main className="min-h-screen bg-background p-5 text-foreground">
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="font-semibold text-base">Daily sticker</h1>
          <p className="text-muted-foreground text-sm">Set the one thing that appears every day.</p>
        </div>
        <div className="space-y-2">
          {taskRows.map((taskRow, index) => (
            <div className="grid grid-cols-[1fr_auto] gap-2" key={taskRow.key}>
              <input
                aria-label={`Daily task ${index + 1}`}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                placeholder={taskQuery.isLoading ? "Loading..." : "Write a daily task"}
                value={taskRow.content}
                onChange={(event) => {
                  setTaskRows(
                    taskRows.map((currentTaskRow) =>
                      currentTaskRow.key === taskRow.key
                        ? { ...currentTaskRow, content: event.target.value }
                        : currentTaskRow,
                    ),
                  );
                }}
              />
              <Button
                aria-label={`Remove task ${index + 1}`}
                disabled={taskRows.length === 1}
                size="icon"
                type="button"
                variant="outline"
                onClick={() =>
                  setTaskRows(
                    taskRows.filter((currentTaskRow) => currentTaskRow.key !== taskRow.key),
                  )
                }
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            className="w-full"
            type="button"
            variant="outline"
            onClick={() => {
              nextRowId.current += 1;
              setTaskRows([...taskRows, newTaskRow(`new-${nextRowId.current}`)]);
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add task
          </Button>
        </div>
        <fieldset className="space-y-2">
          <legend className="font-medium text-sm">Sticker corner</legend>
          <div className="grid grid-cols-4 gap-2">
            {cornerOptions.map((option) => (
              <button
                aria-label={option.label}
                aria-pressed={corner === option.value}
                className={cn(
                  "group relative size-12 rounded-md border border-input bg-background shadow-xs outline-none transition-all duration-150 hover:-translate-y-0.5 hover:scale-105 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  option.tintClassName,
                  corner === option.value && "border-primary bg-accent ring-2 ring-primary/15",
                )}
                key={option.value}
                title={option.label}
                type="button"
                onClick={() => {
                  setCorner(option.value);
                  saveSettings.mutate({ corner: option.value });
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-2 rounded-sm border border-muted-foreground/30 bg-white transition-colors group-hover:border-muted-foreground/50"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute size-2.5 rounded-[3px] shadow-sm transition-transform group-hover:scale-125",
                    option.markerClassName,
                  )}
                />
              </button>
            ))}
          </div>
        </fieldset>
        {isSaving || saved ? (
          <div className="flex justify-end">
            <span className="text-muted-foreground text-sm" role="status">
              {isSaving ? "Saving..." : "Saved"}
            </span>
          </div>
        ) : null}
      </div>
    </main>
  );
}
