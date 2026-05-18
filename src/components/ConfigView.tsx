import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDailyTask, useSaveDailyTask } from "../hooks/useDailyTask";
import { Button } from "./ui/button";

type TaskRow = {
  key: string;
  content: string;
};

function newTaskRow(key: string, content = ""): TaskRow {
  return { key, content };
}

export function ConfigView() {
  const taskQuery = useDailyTask();
  const saveTask = useSaveDailyTask();
  const nextRowId = useRef(0);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([newTaskRow("new-0")]);

  useEffect(() => {
    if (taskQuery.data) {
      setTaskRows(taskQuery.data.map((task) => newTaskRow(`task-${task.id}`, task.content)));
    }
  }, [taskQuery.data]);

  const trimmedContents = taskRows.map((taskRow) => taskRow.content.trim()).filter(Boolean);
  const disabled = saveTask.isPending || trimmedContents.length === 0;

  return (
    <main className="min-h-screen bg-background p-5 text-foreground">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled) {
            saveTask.mutate({ contents: trimmedContents });
          }
        }}
      >
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
        <div className="flex items-center justify-end gap-3">
          {saveTask.isSuccess ? (
            <span className="text-muted-foreground text-sm" role="status">
              Saved
            </span>
          ) : null}
          <Button disabled={disabled} type="submit">
            <Save aria-hidden="true" className="size-4" />
            Save
          </Button>
        </div>
      </form>
    </main>
  );
}
