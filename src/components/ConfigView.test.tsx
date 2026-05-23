import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "../test/render";
import { invokeMock, mockTask, mockTasks } from "../test/tauriMock";
import { ConfigView } from "./ConfigView";

const mockSettings = {
  corner: "top-right",
  display_id: "name:Built-in Display",
  displays: [
    { id: "name:Built-in Display", label: "Built-in Display", current: true },
    { id: "name:Studio Display", label: "Studio Display", current: false },
  ],
} as const;

function mockConfigCommands() {
  invokeMock.mockImplementation((command, args) => {
    if (command === "get_daily_tasks") {
      return Promise.resolve(mockTasks);
    }

    if (command === "get_sticker_settings") {
      return Promise.resolve(mockSettings);
    }

    if (command === "save_daily_tasks") {
      return Promise.resolve(
        (args as { contents: string[] }).contents.map((content, index) => ({
          id: index + 1,
          content,
          date: "2026-05-18",
          completed: false,
        })),
      );
    }

    if (command === "save_sticker_settings") {
      return Promise.resolve({ ...mockSettings, ...(args as object) });
    }

    return Promise.resolve(undefined);
  });
}

describe("ConfigView", () => {
  it("loads existing tasks into editable input rows", async () => {
    mockConfigCommands();

    renderWithQueryClient(<ConfigView />);

    expect(await screen.findByDisplayValue(mockTask.content)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Close the loop")).toBeInTheDocument();
  });

  it("saves trimmed task rows", async () => {
    mockConfigCommands();

    renderWithQueryClient(<ConfigView />);

    const firstInput = await screen.findByDisplayValue(mockTask.content);
    fireEvent.change(firstInput, { target: { value: "  Ship the build  " } });
    fireEvent.change(screen.getByDisplayValue("Close the loop"), { target: { value: "   " } });

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("save_daily_tasks", { contents: ["Ship the build"] }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  });

  it("saves the selected sticker corner", async () => {
    mockConfigCommands();

    renderWithQueryClient(<ConfigView />);

    await screen.findByDisplayValue(mockTask.content);
    fireEvent.click(screen.getByLabelText("Bottom left"));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("save_sticker_settings", {
        corner: "bottom-left",
        display_id: "name:Built-in Display",
      }),
    );
  });

  it("saves the selected sticker display", async () => {
    mockConfigCommands();

    renderWithQueryClient(<ConfigView />);

    expect(await screen.findByText("Built-in Display")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Studio Display" }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("save_sticker_settings", {
        corner: "top-right",
        display_id: "name:Studio Display",
      }),
    );
  });

  it("does not save blank content", async () => {
    invokeMock.mockImplementation((command) => {
      if (command === "get_daily_tasks") {
        return new Promise(() => undefined);
      }

      if (command === "get_sticker_settings") {
        return Promise.resolve(mockSettings);
      }

      return Promise.resolve(undefined);
    });

    const { container } = renderWithQueryClient(<ConfigView />);

    expect(container.querySelector("form")).not.toBeInTheDocument();

    expect(invokeMock).not.toHaveBeenCalledWith("save_daily_tasks", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("save_sticker_settings", expect.anything());
  });

  it("shows saving while task autosave is pending", async () => {
    invokeMock.mockImplementation((command) => {
      if (command === "get_daily_tasks") {
        return Promise.resolve([mockTask]);
      }

      if (command === "get_sticker_settings") {
        return Promise.resolve(mockSettings);
      }

      if (command === "save_daily_tasks") {
        return new Promise(() => undefined);
      }

      return Promise.resolve(undefined);
    });

    renderWithQueryClient(<ConfigView />);

    const firstInput = await screen.findByDisplayValue(mockTask.content);
    fireEvent.change(firstInput, { target: { value: "Keep focus" } });

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saving..."));
  });

  it("adds and removes task rows", async () => {
    invokeMock.mockImplementation((command) => {
      if (command === "get_daily_tasks") {
        return Promise.resolve([mockTask]);
      }

      if (command === "get_sticker_settings") {
        return Promise.resolve(mockSettings);
      }

      return Promise.resolve(undefined);
    });

    renderWithQueryClient(<ConfigView />);

    expect(await screen.findByDisplayValue(mockTask.content)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Daily task 2" }), {
      target: { value: "Plan tomorrow" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove task 1" }));

    expect(screen.queryByDisplayValue(mockTask.content)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Plan tomorrow")).toBeInTheDocument();
  });

  it("shows a loading placeholder before content loads", () => {
    invokeMock.mockImplementation((command) => {
      if (command === "get_daily_tasks") {
        return new Promise(() => undefined);
      }

      if (command === "get_sticker_settings") {
        return Promise.resolve(mockSettings);
      }

      return Promise.resolve(undefined);
    });

    renderWithQueryClient(<ConfigView />);

    expect(screen.getByPlaceholderText("Loading...")).toBeInTheDocument();
  });
});
