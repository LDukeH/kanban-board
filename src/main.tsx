import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./styles/tiptap.css";
import "react-toastify/dist/ReactToastify.css";
import App from "./App.tsx";
import "@/stores/themeStore";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ToastContainer } from "react-toastify";

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    <ToastContainer
      position="bottom-right"
      theme="light"
      closeOnClick
      pauseOnHover
      newestOnTop
    />
  </QueryClientProvider>,
);
