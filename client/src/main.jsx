import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { GroupProvider } from "./context/GroupContext";
import App from "./App";
import "./styles/calm.css";

// Apply the saved theme before render to avoid a light/dark flash.
const saved = localStorage.getItem("bs-theme");
if (saved) document.documentElement.dataset.theme = saved;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <GroupProvider>
          <App />
        </GroupProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
