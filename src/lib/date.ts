const taskDayStartHour = 5;

export function todayKey(now = new Date()): string {
  return taskDayKey(now);
}

export function taskDayKey(now = new Date()): string {
  const taskDay = new Date(now);
  taskDay.setHours(taskDay.getHours() - taskDayStartHour);

  return localDateKey(taskDay);
}

export function nextTaskDayStart(now = new Date()): Date {
  const nextStart = new Date(now);
  nextStart.setHours(taskDayStartHour, 0, 0, 0);

  if (now >= nextStart) {
    nextStart.setDate(nextStart.getDate() + 1);
  }

  return nextStart;
}

export function millisecondsUntilNextTaskDay(now = new Date()): number {
  return Math.max(0, nextTaskDayStart(now).getTime() - now.getTime());
}

function localDateKey(now: Date): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}
