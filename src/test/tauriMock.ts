import { vi } from "vitest";
import type { DailyTask } from "../lib/tauri";

export const mockTask: DailyTask = {
  id: 1,
  content: "Review the daily plan",
  date: "2026-05-18",
  completed: false,
};

export const mockTasks: DailyTask[] = [
  mockTask,
  {
    id: 2,
    content: "Close the loop",
    date: "2026-05-18",
    completed: false,
  },
];

export const invokeMock = vi.fn<(command: string, args?: unknown) => Promise<unknown>>(() =>
  Promise.resolve(undefined),
);

export const stopListeningMock = vi.fn();

export const listenMock = vi.fn<
  (event: string, handler: (event: { payload: DailyTask[] }) => void) => Promise<() => void>
>(() => Promise.resolve(stopListeningMock));
