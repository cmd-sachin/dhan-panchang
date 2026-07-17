import { useEffect, useState } from "react";

// Live online/offline detection — drives the offline-capable messaging.
export function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export type Theme = "light" | "dark";
const LS_THEME = "dp.theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(LS_THEME) as Theme) || "light",
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(LS_THEME, theme);
  }, [theme]);
  return {
    theme,
    toggle: () => setTheme((v) => (v === "light" ? "dark" : "light")),
  };
}
