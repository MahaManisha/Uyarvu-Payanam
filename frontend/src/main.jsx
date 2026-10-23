import React from "react";
import "./index.css";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./admin/context/ThemeContext";
import { AuthProvider } from "./admin/context/AuthContext";
import ErrorBoundary from "./components/common/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </ErrorBoundary>
);