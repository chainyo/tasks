import { Loader2 } from "lucide-react";
import { useDailyTask, useSetTodayCompleted } from "../hooks/useDailyTask";
import type { DailyTask } from "../lib/tauri";
import { Checkbox } from "./ui/checkbox";

export function StickerView() {
  const taskQuery = useDailyTask();
  const completion = useSetTodayCompleted();

  if (taskQuery.isLoading) {
    return (
      <section className="flex h-screen items-center justify-center bg-background px-3">
        <Loader2 aria-label="Loading task" className="size-4 animate-spin text-muted-foreground" />
      </section>
    );
  }

  if (taskQuery.isError) {
    return (
      <section className="flex h-screen items-center bg-background px-3 text-destructive text-xs">
        Could not load today&apos;s task.
      </section>
    );
  }

  const tasks = taskQuery.data as DailyTask[];

  return (
    <main data-tauri-drag-region className="h-screen bg-background px-3 py-1.5 text-foreground">
      <div className="grid gap-1.5">
        {tasks.map((task) => (
          <div key={task.id} className="grid grid-cols-[auto_1fr] items-center gap-2.5">
            <Checkbox
              aria-label={`Complete ${task.content}`}
              checked={task.completed}
              disabled={completion.isPending}
              onCheckedChange={(checked) => completion.mutate({ id: task.id, completed: checked })}
            />
            <span
              className={
                task.completed
                  ? "truncate text-muted-foreground text-xs leading-5 line-through"
                  : "truncate text-xs leading-5"
              }
            >
              {task.content}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
