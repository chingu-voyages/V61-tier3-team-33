import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

// What the context will share with the rest of the app that consumes it 
interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;   
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Checks which preferred theme is set in the local storage and returns it, if not, it returns the preferred theme of the user system
function getTheInitialTheme(): Theme {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}


export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getTheInitialTheme);

  // Each time that the theme changes, it will do two things: update the data-theme attribute of the html element and save the new theme in the local storage
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // The fonction to change the theme from light to dark and vice versa
  function toggleTheme() {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// It's the hook that will be used in the components to access the theme and the toggleTheme function
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
