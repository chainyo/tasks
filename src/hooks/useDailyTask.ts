import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type DailyTask,
  type DailyTaskUpdate,
  getDailyTasks,
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
