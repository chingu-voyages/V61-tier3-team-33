import "./App.css";
import { ThemeToggle } from "./components/ThemeToggle";

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>ChinguChess</h1>
        <ThemeToggle />
      </header>
    </div>
  );
}

export default App;
