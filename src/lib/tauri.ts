import { invoke } from "@tauri-apps/api/core";

export type DailyTask = {
  id: number;
  content: string;
  date: string;
  completed: boolean;
};

export type DailyTaskUpdate = {
  contents: string[];
};

export function getDailyTasks(): Promise<DailyTask[]> {
  return invoke<DailyTask[]>("get_daily_tasks");
}

export function saveDailyTasks(update: DailyTaskUpdate): Promise<DailyTask[]> {
  return invoke<DailyTask[]>("save_daily_tasks", update);
}

export function setTodayCompleted(id: number, completed: boolean): Promise<DailyTask[]> {
  return invoke<DailyTask[]>("set_today_completed", { id, completed });
}
