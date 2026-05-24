import { millisecondsUntilNextTaskDay, nextTaskDayStart, taskDayKey, todayKey } from "./date";

describe("todayKey", () => {
  it("formats a local date key", () => {
    expect(todayKey(new Date(2026, 4, 8, 5))).toBe("2026-05-08");
  });

  it("uses the 5 AM task day boundary", () => {
    expect(taskDayKey(new Date(2026, 4, 18, 4, 59))).toBe("2026-05-17");
    expect(taskDayKey(new Date(2026, 4, 18, 5, 0))).toBe("2026-05-18");
  });

  it("finds the next 5 AM task day start", () => {
    expect(nextTaskDayStart(new Date(2026, 4, 18, 4, 30))).toEqual(new Date(2026, 4, 18, 5, 0));
    expect(nextTaskDayStart(new Date(2026, 4, 18, 5, 0))).toEqual(new Date(2026, 4, 19, 5, 0));
  });

  it("calculates milliseconds until the next task day", () => {
    expect(millisecondsUntilNextTaskDay(new Date(2026, 4, 18, 4, 59, 59))).toBe(1000);
  });
});
