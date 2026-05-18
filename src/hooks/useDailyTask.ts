import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  type DailyTask,
  type DailyTaskUpdate,
  getDailyTasks,
  hideStickerUntilTomorrow,
  listenDailyTasksChanged,
  reorderDailyTasks,
  saveDailyTasks,
  setTodayCompleted,
} from "../lib/tauri";

export const dailyTaskQueryKey = ["daily-tasks"] as const;

export function useDailyTask() {
  return useQuery({
    queryKey: dailyTaskQueryKey,
    queryFn: getDailyTasks,
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
}

export function useSaveDailyTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (update: DailyTaskUpdate) => saveDailyTasks(update),
    onSuccess: (tasks) => queryClient.setQueryData<DailyTask[]>(dailyTaskQueryKey, tasks),
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
