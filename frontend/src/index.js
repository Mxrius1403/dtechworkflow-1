import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

// The old Firebase version of the app installed a service worker that could keep
// answering requests with stored copies. This app has none, so remove what is left.
navigator.serviceWorker?.getRegistrations()
  .then((registrations) => registrations.forEach((registration) => registration.unregister()))
  .catch(() => {});
window.caches?.keys()
  .then((keys) => keys.forEach((key) => window.caches.delete(key)))
  .catch(() => {});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
