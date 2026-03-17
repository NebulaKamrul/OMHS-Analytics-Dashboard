import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply saved theme before React renders to avoid flash
try {
  const t = localStorage.getItem("theme");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
} catch {}

createRoot(document.getElementById("root")!).render(<App />);
