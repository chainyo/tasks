import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type DailyTask = {
  id: number;
  content: string;
  date: string;
  completed: boolean;
};

export type DailyTaskUpdate = {
  contents: string[];
};

export type StickerCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type StickerDisplay = {
  id: string;
  label: string;
  current: boolean;
};

export type StickerSettings = {
  corner: StickerCorner;
  display_id: string | null;
  displays: StickerDisplay[];
};

export type StickerSettingsUpdate = {
  corner: StickerCorner;
  display_id: string | null;
};

export function getDailyTasks(): Promise<DailyTask[]> {
  return invoke<DailyTask[]>("get_daily_tasks");
}

export function getStickerSettings(): Promise<StickerSettings> {
  return invoke<StickerSettings>("get_sticker_settings");
}

export function saveStickerSettings(settings: StickerSettingsUpdate): Promise<StickerSettings> {
  return invoke<StickerSettings>("save_sticker_settings", settings);
}

export function saveDailyTasks(update: DailyTaskUpdate): Promise<DailyTask[]> {
  return invoke<DailyTask[]>("save_daily_tasks", update);
}

export function setTodayCompleted(id: number, completed: boolean): Promise<DailyTask[]> {
  return invoke<DailyTask[]>("set_today_completed", { id, completed });
}

export function reorderDailyTasks(ids: number[]): Promise<DailyTask[]> {
  return invoke<DailyTask[]>("reorder_daily_tasks", { ids });
}

export function hideStickerUntilTomorrow(): Promise<void> {
  return invoke<void>("hide_sticker_until_tomorrow");
}

export function resizeStickerWindow(height: number): Promise<void> {
  return invoke<void>("resize_sticker_window", { height });
}

export function listenDailyTasksChanged(
  onChanged: (tasks: DailyTask[]) => void,
): Promise<() => void> {
  return listen<DailyTask[]>("daily-tasks-changed", (event) => onChanged(event.payload));
}
