import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "@/lib/auth/provider";
import { AppProviders } from "@/components/es/providers";
import { ScrollManager } from "@/components/es/scroll-manager";
import "./es.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppProviders>
          <App />
          <ScrollManager />
        </AppProviders>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
