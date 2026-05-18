import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2 } from "lucide-react";
import type { CSSProperties } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import {
  useDailyTask,
  useHideStickerUntilTomorrow,
  useReorderDailyTasks,
  useSetTodayCompleted,
} from "../hooks/useDailyTask";
import type { DailyTask } from "../lib/tauri";
import { resizeStickerWindow } from "../lib/tauri";
import { Checkbox } from "./ui/checkbox";

const minimumStickerHeight = 32;

export function orderTasksForSticky(tasks: DailyTask[]) {
  return [...tasks].sort((taskA, taskB) => Number(taskA.completed) - Number(taskB.completed));
}

export function taskDate(tasks: DailyTask[]) {
  return tasks[0]?.date ?? "";
}

export function areAllTasksCompleted(tasks: DailyTask[]) {
  return tasks.length > 0 && tasks.every((task) => task.completed);
}

export function shouldShowHidePrompt(tasks: DailyTask[], dismissedDate: string | null) {
  const date = taskDate(tasks);

  return areAllTasksCompleted(tasks) && dismissedDate !== date;
}

export function reorderIncompleteTasks(tasks: DailyTask[], draggedId: number, targetId: number) {
  const orderedTasks = orderTasksForSticky(tasks);
  const incompleteTasks = orderedTasks.filter((task) => !task.completed);
  const completedTasks = orderedTasks.filter((task) => task.completed);
  const draggedIndex = incompleteTasks.findIndex((task) => task.id === draggedId);
  const targetIndex = incompleteTasks.findIndex((task) => task.id === targetId);

  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return orderedTasks;
  }

  const nextIncompleteTasks = [...incompleteTasks];
  const [draggedTask] = nextIncompleteTasks.splice(draggedIndex, 1);
  nextIncompleteTasks.splice(targetIndex, 0, draggedTask);

  return [...nextIncompleteTasks, ...completedTasks];
}

export function taskIds(tasks: DailyTask[]) {
  return tasks.map((task) => task.id);
}

export function reorderTasksFromDragEnd(tasks: DailyTask[], event: DragEndEvent) {
  const activeId = Number(event.active.id);
  const overId = event.over ? Number(event.over.id) : Number.NaN;

  if (!Number.isFinite(activeId) || !Number.isFinite(overId)) {
    return orderTasksForSticky(tasks);
  }

  return reorderIncompleteTasks(tasks, activeId, overId);
}

export function changedTaskIds(currentTasks: DailyTask[], nextTasks: DailyTask[]) {
  const currentIds = taskIds(currentTasks);
  const nextIds = taskIds(nextTasks);

  return currentIds.join(",") === nextIds.join(",") ? null : nextIds;
}

export function persistDragEnd(
  tasks: DailyTask[],
  event: DragEndEvent,
  persistTaskIds: (ids: number[]) => void,
) {
  const nextTaskIds = changedTaskIds(tasks, reorderTasksFromDragEnd(tasks, event));

  if (nextTaskIds) {
    persistTaskIds(nextTaskIds);
  }
}

export function createDragEndHandler(tasks: DailyTask[], persistTaskIds: (ids: number[]) => void) {
  return (event: DragEndEvent) => persistDragEnd(tasks, event, persistTaskIds);
}

export function resizeRenderedSticker(sticker: HTMLElement | null) {
  if (!sticker) {
    return;
  }

  const height = Math.max(minimumStickerHeight, Math.ceil(sticker.scrollHeight));
  void resizeStickerWindow(height);
}

export function animateTaskReorder(
  taskRefs: Map<number, HTMLElement>,
  previousPositions: Map<number, number>,
) {
  const nextPositions = new Map<number, number>();

  for (const [id, element] of taskRefs) {
    const nextTop = element.getBoundingClientRect().top;
    const previousTop = previousPositions.get(id);
    nextPositions.set(id, nextTop);

    if (previousTop !== undefined && previousTop !== nextTop) {
      element.animate(
        [{ transform: `translateY(${previousTop - nextTop}px)` }, { transform: "translateY(0)" }],
        { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" },
      );
    }
  }

  return nextPositions;
}

type StickerTaskRowProps = {
  task: DailyTask;
  completionPending: boolean;
  reorderPending: boolean;
  onCheckedChange: (checked: boolean) => void;
  setTaskElement: (element: HTMLElement | null) => void;
};

function StickerTaskRow({
  task,
  completionPending,
  reorderPending,
  onCheckedChange,
  setTaskElement,
}: StickerTaskRowProps) {
  const sortable = useSortable({
    id: task.id,
    disabled: task.completed,
  });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <li
      ref={(element) => {
        setTaskElement(element);
        sortable.setNodeRef(element);
      }}
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-2"
      style={style}
      tabIndex={-1}
    >
      <Checkbox
        aria-label={`Complete ${task.content}`}
        checked={task.completed}
        disabled={completionPending || reorderPending}
        onCheckedChange={onCheckedChange}
      />
      <span
        className={
          task.completed
            ? "min-w-0 whitespace-normal break-words text-muted-foreground text-xs leading-5 line-through"
            : "min-w-0 whitespace-normal break-words text-xs leading-5"
        }
      >
        {task.content}
      </span>
      {task.completed ? (
        <span aria-hidden="true" className="size-4" />
      ) : (
        <button
          aria-label={`Reorder ${task.content}`}
          className="grid size-4 cursor-grab place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent active:cursor-grabbing group-hover:opacity-100 group-focus-within:opacity-100"
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </li>
  );
}

export function StickerView() {
  const taskQuery = useDailyTask();
  const completion = useSetTodayCompleted();
  const reorder = useReorderDailyTasks();
  const hideUntilTomorrow = useHideStickerUntilTomorrow();
  const stickerRef = useRef<HTMLElement>(null);
  const taskRefs = useRef(new Map<number, HTMLElement>());
  const taskPositions = useRef(new Map<number, number>());
  const [dismissedPromptDate, setDismissedPromptDate] = useState<string | null>(null);

  const renderedTasks = taskQuery.data as DailyTask[] | undefined;
  useLayoutEffect(() => {
    resizeRenderedSticker(stickerRef.current);
  });

  useLayoutEffect(() => {
    taskPositions.current = animateTaskReorder(taskRefs.current, taskPositions.current);
  });

  if (taskQuery.isLoading) {
    return (
      <section
        ref={stickerRef}
        className="flex min-h-8 items-center justify-center bg-background px-3 py-1.5"
      >
        <Loader2 aria-label="Loading task" className="size-4 animate-spin text-muted-foreground" />
      </section>
    );
  }

  if (taskQuery.isError) {
    return (
      <section
        ref={stickerRef}
        className="flex min-h-8 items-center bg-background px-3 py-1.5 text-destructive text-xs"
      >
        Could not load today&apos;s task.
      </section>
    );
  }

  const tasks = orderTasksForSticky(renderedTasks as DailyTask[]);
  const incompleteTaskIds = tasks.filter((task) => !task.completed).map((task) => task.id);
  const showHidePrompt = shouldShowHidePrompt(tasks, dismissedPromptDate);

  return (
    <main
      ref={stickerRef}
      className={
        showHidePrompt
          ? "relative min-h-28 bg-background px-3 py-1.5 text-foreground"
          : "relative bg-background px-3 py-1.5 text-foreground"
      }
    >
      {showHidePrompt ? (
        <div className="absolute inset-0 z-10 grid place-items-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-background/45 shadow-inner backdrop-blur-[2px]"
          />
          <section className="relative z-10 w-[calc(100%-1.5rem)] rounded-md border border-border bg-background p-2 shadow-lg">
            <p className="text-xs leading-4">Hide this sticky until tomorrow?</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                className="h-7 rounded border border-border px-2 text-xs hover:bg-accent"
                type="button"
                onClick={() => setDismissedPromptDate(taskDate(tasks))}
              >
                Not now
              </button>
              <button
                className="h-7 rounded bg-primary px-2 text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50"
                disabled={hideUntilTomorrow.isPending}
                type="button"
                onClick={() => hideUntilTomorrow.mutate()}
              >
                Hide
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <DndContext onDragEnd={createDragEndHandler(tasks, reorder.mutate)}>
        <SortableContext items={incompleteTaskIds} strategy={verticalListSortingStrategy}>
          <ul className="grid list-none gap-1.5 p-0">
            {tasks.map((task) => (
              <StickerTaskRow
                key={task.id}
                task={task}
                completionPending={completion.isPending}
                reorderPending={reorder.isPending}
                setTaskElement={(element) => {
                  if (element) {
                    taskRefs.current.set(task.id, element);
                  } else {
                    taskRefs.current.delete(task.id);
                  }
                }}
                onCheckedChange={(checked) =>
                  completion.mutate({ id: task.id, completed: checked })
                }
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </main>
  );
}
