// This component is that button that will allows the user to toggle between light and dark themes. 
// It uses the useTheme hook to access the current theme and the toggleTheme function from the ThemeContext.

import { useTheme } from "../context/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      style={{
        background: "none",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        fontSize: "1.25rem",
        padding: "0.4rem 0.6rem",
        color: "var(--color-text)",
        lineHeight: 1,
      }}
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
