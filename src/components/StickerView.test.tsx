import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "../test/render";
import { invokeMock, mockTask, mockTasks } from "../test/tauriMock";
import { StickerView } from "./StickerView";

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

  it("marks today completed", async () => {
    invokeMock.mockResolvedValueOnce(mockTasks);
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
});
