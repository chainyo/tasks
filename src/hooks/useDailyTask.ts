import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { millisecondsUntilNextTaskDay } from "../lib/date";
import {
  type DailyTask,
  type DailyTaskUpdate,
  getDailyTasks,
  getStickerSettings,
  hideStickerUntilTomorrow,
  listenDailyTasksChanged,
  reorderDailyTasks,
  type StickerSettings,
  type StickerSettingsUpdate,
  saveDailyTasks,
  saveStickerSettings,
  setTodayCompleted,
} from "../lib/tauri";

export const dailyTaskQueryKey = ["daily-tasks"] as const;
export const stickerSettingsQueryKey = ["sticker-settings"] as const;
const taskDayRolloverBufferMs = 1000;

export function useDailyTask() {
  return useQuery({
    queryKey: dailyTaskQueryKey,
    queryFn: getDailyTasks,
  });
}

export function useStickerSettings() {
  return useQuery({
    queryKey: stickerSettingsQueryKey,
    queryFn: getStickerSettings,
  });
}

export function useDailyTaskSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unlisten = listenDailyTasksChanged((tasks) => {
      queryClient.setQueryData<DailyTask[]>(dailyTaskQueryKey, tasks);
    });

    return () => {
      void unlisten.then((stopListening) => stopListening());
    };
  }, [queryClient]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextTaskDayRefresh = () => {
      timeout = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: dailyTaskQueryKey });
        scheduleNextTaskDayRefresh();
      }, millisecondsUntilNextTaskDay() + taskDayRolloverBufferMs);
    };

    scheduleNextTaskDayRefresh();

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [queryClient]);
}

export function useSaveDailyTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (update: DailyTaskUpdate) => saveDailyTasks(update),
    onSuccess: (tasks) => queryClient.setQueryData<DailyTask[]>(dailyTaskQueryKey, tasks),
  });
}

export function useSaveStickerSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: StickerSettingsUpdate) => saveStickerSettings(settings),
    onSuccess: (settings) =>
      queryClient.setQueryData<StickerSettings>(stickerSettingsQueryKey, settings),
  });
}

export function useSetTodayCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) =>
      setTodayCompleted(id, completed),
    onSuccess: (tasks) => queryClient.setQueryData<DailyTask[]>(dailyTaskQueryKey, tasks),
  });
}

export function useReorderDailyTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: number[]) => reorderDailyTasks(ids),
    onSuccess: (tasks) => queryClient.setQueryData<DailyTask[]>(dailyTaskQueryKey, tasks),
  });
}

export function useHideStickerUntilTomorrow() {
  return useMutation({
    mutationFn: hideStickerUntilTomorrow,
  });
}
