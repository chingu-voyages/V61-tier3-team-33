import Link from "next/link"
import { IconWorld, IconUsers } from "@tabler/icons-react"

import { WHITE, BLACK, KNIGHT } from "@/core/piece"
import { getPieceIcon } from "@/components/pieces"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"

const playModes = [
  {
    title: "Play a Friend",
    description: "Challenge a friend to a game",
    icon: IconUsers,
    href: "/play?mode=friend",
  },
  {
    title: "Play Online",
    description: "Match with players from around the world",
    icon: IconWorld,
    href: "/play?mode=online",
  },
]

export function MainPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-4">
          <div className="[&_svg]:-scale-x-100">
            {getPieceIcon({ type: KNIGHT, color: WHITE }, { className: "size-32" })}
          </div>
          <div>
            {getPieceIcon({ type: KNIGHT, color: BLACK }, { className: "size-32" })}
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to Chingu Chess
        </h1>
        <p className="max-w-md text-muted-foreground">
          Choose how you'd like to play
        </p>
      </div>
      <div className="flex w-full max-w-2xl flex-row flex-wrap justify-center gap-4">
        {playModes.map((mode) => (
          <Link key={mode.title} href={mode.href} className="flex-1 basis-64">
            <Card className="h-full cursor-pointer border border-border/50 shadow-lg transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-xl">
              <CardHeader>
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <mode.icon className="size-10 text-muted-foreground" />
                  <div className="flex flex-col gap-1.5">
                    <CardTitle>{mode.title}</CardTitle>
                    <CardDescription>{mode.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  )
}
