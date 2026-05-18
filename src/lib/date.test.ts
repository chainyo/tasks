import { todayKey } from "./date";

describe("todayKey", () => {
  it("formats a local date key", () => {
    expect(todayKey(new Date(2026, 4, 8))).toBe("2026-05-08");
  });
});
