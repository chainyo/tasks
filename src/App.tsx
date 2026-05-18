import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigView } from "./components/ConfigView";
import { StickerView } from "./components/StickerView";
import { useDailyTaskSync } from "./hooks/useDailyTask";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent mode={window.location.hash === "#config" ? "config" : "sticker"} />
    </QueryClientProvider>
  );
}

function AppContent({ mode }: AppShellProps) {
  useDailyTaskSync();

  return <AppShell mode={mode} />;
}

export type AppShellProps = {
  mode: "sticker" | "config";
};

export function AppShell({ mode }: AppShellProps) {
  if (mode === "config") {
    return <ConfigView />;
  }

  return <StickerView />;
}
