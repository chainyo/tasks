import { screen } from "@testing-library/react";
import { App, AppShell } from "./App";
import { renderWithQueryClient } from "./test/render";
import { invokeMock, listenMock, stopListeningMock } from "./test/tauriMock";

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

  it("renders the App config mode from the hash", async () => {
    window.location.hash = "#config";
    invokeMock.mockResolvedValueOnce([
      {
        id: 1,
        content: "Plan the day",
        date: "2026-05-18",
        completed: false,
      },
    ]);

    renderWithQueryClient(<App />);

    expect(await screen.findByRole("heading", { name: "Daily sticker" })).toBeInTheDocument();
  });

  it("renders the config window mode", async () => {
    invokeMock.mockResolvedValueOnce([
      {
        id: 1,
        content: "Plan the day",
        date: "2026-05-18",
        completed: false,
      },
    ]);

    renderWithQueryClient(<AppShell mode="config" />);

    expect(await screen.findByRole("heading", { name: "Daily sticker" })).toBeInTheDocument();
  });
});
