import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { App, AppShell } from "./App";
import { dailyTaskQueryKey, useDailyTaskSync } from "./hooks/useDailyTask";
import { renderWithQueryClient } from "./test/render";
import { invokeMock, listenMock, stopListeningMock } from "./test/tauriMock";

const mockSettings = {
  corner: "top-right",
  display_id: "name:Built-in Display",
  displays: [{ id: "name:Built-in Display", label: "Built-in Display", current: true }],
} as const;

afterEach(() => {
  vi.useRealTimers();
});

describe("AppShell", () => {
  it("renders the App sticker mode by default", async () => {
    window.location.hash = "";
    invokeMock.mockResolvedValueOnce([
      {
        id: 1,
        content: "Plan the day",
        date: "2026-05-18",
        completed: false,
      },
    ]);

    renderWithQueryClient(<App />);

    expect(await screen.findByText("Plan the day")).toBeInTheDocument();
  });

  it("refreshes sticker tasks from the app-wide task event", async () => {
    window.location.hash = "";
    invokeMock.mockResolvedValueOnce([
      {
        id: 1,
        content: "Plan the day",
        date: "2026-05-18",
        completed: false,
      },
    ]);

    const rendered = renderWithQueryClient(<App />);

    expect(await screen.findByText("Plan the day")).toBeInTheDocument();
    const onEvent = listenMock.mock.calls[0]?.[1] as (event: {
      payload: Array<{ id: number; content: string; date: string; completed: boolean }>;
    }) => void;
    onEvent({
      payload: [
        {
          id: 2,
          content: "Write launch note",
          date: "2026-05-18",
          completed: false,
        },
      ],
    });

    expect(await screen.findByText("Write launch note")).toBeInTheDocument();
    rendered.unmount();
    await Promise.resolve();
    expect(stopListeningMock).toHaveBeenCalled();
  });

  it("invalidates sticker tasks after the 5 AM task day rollover", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 18, 4, 59, 59, 500));
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    function SyncOnly() {
      useDailyTaskSync();
      return null;
    }

    render(
      <QueryClientProvider client={queryClient}>
        <SyncOnly />
      </QueryClientProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dailyTaskQueryKey });
  });

  it("renders the App config mode from the hash", async () => {
    window.location.hash = "#config";
    invokeMock.mockImplementation((command) => {
      if (command === "get_daily_tasks") {
        return Promise.resolve([
          {
            id: 1,
            content: "Plan the day",
            date: "2026-05-18",
            completed: false,
          },
        ]);
      }

      if (command === "get_sticker_settings") {
        return Promise.resolve(mockSettings);
      }

      return Promise.resolve(undefined);
    });

    renderWithQueryClient(<App />);

    expect(await screen.findByRole("heading", { name: "Daily sticker" })).toBeInTheDocument();
  });

  it("renders the config window mode", async () => {
    invokeMock.mockImplementation((command) => {
      if (command === "get_daily_tasks") {
        return Promise.resolve([
          {
            id: 1,
            content: "Plan the day",
            date: "2026-05-18",
            completed: false,
          },
        ]);
      }

      if (command === "get_sticker_settings") {
        return Promise.resolve(mockSettings);
      }

      return Promise.resolve(undefined);
    });

    renderWithQueryClient(<AppShell mode="config" />);

    expect(await screen.findByRole("heading", { name: "Daily sticker" })).toBeInTheDocument();
  });
});
