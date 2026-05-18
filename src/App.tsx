import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigView } from "./components/ConfigView";
import { StickerView } from "./components/StickerView";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell mode={window.location.hash === "#config" ? "config" : "sticker"} />
    </QueryClientProvider>
  );
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
