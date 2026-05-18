import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { dailyTaskQueryKey, useReorderDailyTasks } from "../hooks/useDailyTask";
import { renderWithQueryClient } from "../test/render";
import { invokeMock, mockTask, mockTasks } from "../test/tauriMock";
import {
  animateTaskReorder,
  areAllTasksCompleted,
  changedTaskIds,
  createDragEndHandler,
  orderTasksForSticky,
  persistDragEnd,
  reorderIncompleteTasks,
  reorderTasksFromDragEnd,
  resizeRenderedSticker,
  StickerView,
  shouldShowHidePrompt,
  taskDate,
  taskIds,
} from "./StickerView";

describe("StickerView", () => {
  it("shows the task content", async () => {
    invokeMock.mockResolvedValueOnce(mockTasks);

    renderWithQueryClient(<StickerView />);

    expect(await screen.findByText(mockTask.content)).toBeInTheDocument();
    expect(screen.getByText("Close the loop")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: `Complete ${mockTask.content}` }),
    ).not.toBeChecked();
  });

  it("orders incomplete tasks before completed tasks", () => {
    expect(orderTasksForSticky([{ ...mockTask, completed: true }, mockTasks[1]])).toEqual([
      mockTasks[1],
      { ...mockTask, completed: true },
    ]);
  });

  it("detects completed task days for the hide prompt", () => {
    const completedTasks = mockTasks.map((task) => ({ ...task, completed: true }));

    expect(taskDate(completedTasks)).toBe(mockTask.date);
    expect(taskDate([])).toBe("");
    expect(areAllTasksCompleted(completedTasks)).toBe(true);
    expect(areAllTasksCompleted([])).toBe(false);
    expect(shouldShowHidePrompt(completedTasks, null)).toBe(true);
    expect(shouldShowHidePrompt(completedTasks, mockTask.date)).toBe(false);
    expect(shouldShowHidePrompt(mockTasks, null)).toBe(false);
  });

  it("reorders incomplete tasks without moving completed tasks", () => {
    const completedTask = { ...mockTask, id: 3, completed: true };
    const reorderedTasks = reorderIncompleteTasks(
      [mockTasks[0], mockTasks[1], completedTask],
      2,
      1,
    );

    expect(taskIds(reorderedTasks)).toEqual([2, 1, 3]);
    expect(reorderedTasks[2]).toEqual(completedTask);
  });

  it("keeps task order for invalid reorder targets", () => {
    const completedTask = { ...mockTask, id: 3, completed: true };

    expect(reorderIncompleteTasks([mockTasks[0], completedTask], 1, completedTask.id)).toEqual([
      mockTasks[0],
      completedTask,
    ]);
    expect(reorderIncompleteTasks(mockTasks, 1, 1)).toEqual(mockTasks);
    expect(reorderIncompleteTasks(mockTasks, 404, 1)).toEqual(mockTasks);
  });

  it("resolves reordered task ids from sortable drag end events", () => {
    expect(
      taskIds(
        reorderTasksFromDragEnd(mockTasks, {
          active: { id: 1 },
          over: { id: 2 },
        } as never),
      ),
    ).toEqual([2, 1]);
    expect(
      reorderTasksFromDragEnd(mockTasks, {
        active: { id: 1 },
        over: null,
      } as never),
    ).toEqual(mockTasks);
  });

  it("persists changed drag order only", () => {
    const persistTaskIds = vi.fn();
    const dragEndHandler = createDragEndHandler(mockTasks, persistTaskIds);

    expect(changedTaskIds(mockTasks, [mockTasks[1], mockTasks[0]])).toEqual([2, 1]);
    expect(changedTaskIds(mockTasks, mockTasks)).toBeNull();

    dragEndHandler({
      active: { id: 1 },
      over: { id: 2 },
    } as never);
    persistDragEnd(
      mockTasks,
      {
        active: { id: 1 },
        over: { id: 1 },
      } as never,
      persistTaskIds,
    );

    expect(persistTaskIds).toHaveBeenCalledTimes(1);
    expect(persistTaskIds).toHaveBeenCalledWith([2, 1]);
  });

  it("persists reordered tasks through the daily task hook", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    invokeMock.mockResolvedValueOnce([mockTasks[1], mockTasks[0]]);

    const { result } = renderHook(() => useReorderDailyTasks(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    result.current.mutate([2, 1]);

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("reorder_daily_tasks", { ids: [2, 1] }),
    );
    expect(queryClient.getQueryData(dailyTaskQueryKey)).toEqual([mockTasks[1], mockTasks[0]]);
  });

  it("shows the reorder handle on the right for incomplete tasks only", async () => {
    const completedTask = { ...mockTasks[1], completed: true };
    invokeMock.mockResolvedValueOnce([mockTask, completedTask]);

    renderWithQueryClient(<StickerView />);

    const reorderHandle = await screen.findByRole("button", {
      name: `Reorder ${mockTask.content}`,
    });
    const taskRow = screen.getByText(mockTask.content).closest("li");
    const completedRow = screen.getByText(completedTask.content).closest("li");

    expect(taskRow?.lastElementChild).toBe(reorderHandle);
    expect(reorderHandle).toHaveClass("opacity-0");
    expect(
      screen.queryByRole("button", { name: `Reorder ${completedTask.content}` }),
    ).not.toBeInTheDocument();
    expect(completedRow?.lastElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("asks to hide the sticky when every task is completed", async () => {
    const completedTasks = mockTasks.map((task) => ({ ...task, completed: true }));
    invokeMock.mockResolvedValueOnce(completedTasks);

    renderWithQueryClient(<StickerView />);

    expect(await screen.findByText("Hide this sticky until tomorrow?")).toBeInTheDocument();
    expect(screen.getByText("Hide this sticky until tomorrow?").closest("section")).toHaveClass(
      "relative",
      "z-10",
      "shadow-lg",
    );
    expect(screen.getByText("Hide this sticky until tomorrow?").closest("main")).toHaveClass(
      "min-h-28",
    );

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.queryByText("Hide this sticky until tomorrow?")).not.toBeInTheDocument();
  });

  it("hides the sticky until the next task day from the completion prompt", async () => {
    const completedTasks = mockTasks.map((task) => ({ ...task, completed: true }));
    invokeMock.mockResolvedValueOnce(completedTasks);
    invokeMock.mockResolvedValueOnce(undefined);

    renderWithQueryClient(<StickerView />);

    fireEvent.click(await screen.findByRole("button", { name: "Hide" }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("hide_sticker_until_tomorrow", undefined),
    );
  });

  it("animates task rows when completion changes their order", async () => {
    const animateMock = vi.fn();
    const element = {
      animate: animateMock,
      getBoundingClientRect: () => ({ top: 10 }),
    } as unknown as HTMLDivElement;

    const nextPositions = animateTaskReorder(new Map([[1, element]]), new Map([[1, 40]]));

    expect(animateMock).toHaveBeenCalledWith(
      [{ transform: "translateY(30px)" }, { transform: "translateY(0)" }],
      { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" },
    );
    expect(nextPositions.get(1)).toBe(10);
  });

  it("marks today completed", async () => {
    invokeMock.mockResolvedValueOnce([{ ...mockTask, completed: false }]);
    invokeMock.mockResolvedValueOnce([{ ...mockTask, completed: true }]);

    renderWithQueryClient(<StickerView />);

    fireEvent.click(await screen.findByRole("checkbox", { name: `Complete ${mockTask.content}` }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("set_today_completed", {
        id: mockTask.id,
        completed: true,
      }),
    );
  });

  it("shows an error state when loading fails", async () => {
    invokeMock.mockRejectedValueOnce(new Error("database unavailable"));

    renderWithQueryClient(<StickerView />);

    expect(await screen.findByText("Could not load today's task.")).toBeInTheDocument();
  });

  it("shows the loading state", () => {
    invokeMock.mockImplementationOnce(() => new Promise(() => undefined));

    renderWithQueryClient(<StickerView />);

    expect(screen.getByLabelText("Loading task")).toBeInTheDocument();
  });

  it("ignores missing sticker elements during resize", () => {
    resizeRenderedSticker(null);

    expect(invokeMock).not.toHaveBeenCalledWith("resize_sticker_window", expect.anything());
  });
});
