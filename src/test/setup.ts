import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { invokeMock, listenMock, stopListeningMock } from "./tauriMock";

vi.doMock("@tauri-apps/api/core", () => ({
  invoke: (command: string, args?: unknown) => {
    if (command === "resize_sticker_window") {
      return Promise.resolve(undefined);
    }

    return invokeMock(command, args);
  },
}));

vi.doMock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

afterEach(() => {
  vi.clearAllMocks();
  invokeMock.mockImplementation(() => Promise.resolve(undefined));
  listenMock.mockImplementation(() => Promise.resolve(stopListeningMock));
});
