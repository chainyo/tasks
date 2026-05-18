import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "../test/render";
import { invokeMock, mockTask, mockTasks } from "../test/tauriMock";
import { ConfigView } from "./ConfigView";

describe("ConfigView", () => {
  it("loads existing tasks into editable input rows", async () => {
    invokeMock.mockResolvedValueOnce(mockTasks);

    renderWithQueryClient(<ConfigView />);

    expect(await screen.findByDisplayValue(mockTask.content)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Close the loop")).toBeInTheDocument();
  });

  it("saves trimmed task rows", async () => {
    invokeMock.mockResolvedValueOnce(mockTasks);
    invokeMock.mockResolvedValueOnce([{ ...mockTask, content: "Ship the build" }]);

    renderWithQueryClient(<ConfigView />);

    const firstInput = await screen.findByDisplayValue(mockTask.content);
    fireEvent.change(firstInput, { target: { value: "  Ship the build  " } });
    fireEvent.change(screen.getByDisplayValue("Close the loop"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("save_daily_tasks", { contents: ["Ship the build"] }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  });

  it("does not save blank content", async () => {
    invokeMock.mockImplementationOnce(() => new Promise(() => undefined));

    const { container } = renderWithQueryClient(<ConfigView />);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("disables save while a save is pending", async () => {
    invokeMock.mockResolvedValueOnce([mockTask]);
    invokeMock.mockImplementationOnce(() => new Promise(() => undefined));

    renderWithQueryClient(<ConfigView />);

    const firstInput = await screen.findByDisplayValue(mockTask.content);
    fireEvent.change(firstInput, { target: { value: "Keep focus" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled());
  });

  it("adds and removes task rows", async () => {
    invokeMock.mockResolvedValueOnce([mockTask]);

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
    invokeMock.mockImplementationOnce(() => new Promise(() => undefined));

    renderWithQueryClient(<ConfigView />);

    expect(screen.getByPlaceholderText("Loading...")).toBeInTheDocument();
  });
});
