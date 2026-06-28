import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <h1 className="text-xl font-semibold">ChinguChess</h1>
        <ThemeToggle />
      </header>
    </div>
  );
}
