import { createRoot } from "react-dom/client";
import { applyTheme, readStoredTheme } from "./components/ThemeToggle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

// Resolve the theme before first paint to avoid a flash of the light palette.
applyTheme(readStoredTheme());

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
