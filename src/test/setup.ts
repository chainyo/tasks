import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { invokeMock } from "./tauriMock";

vi.doMock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

afterEach(() => {
  vi.clearAllMocks();
});
