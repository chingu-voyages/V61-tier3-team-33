import Link from "next/link"
import { IconWorld, IconUsers, IconDeviceGamepad2 } from "@tabler/icons-react"

import { WHITE, BLACK, KNIGHT } from "@/core/piece"
import { getPieceIcon } from "@/components/pieces"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useRoom } from "@/context/room/context"
import { ACTIVE, FINISHED } from "@/socket/types"

const playModes = [
  {
    title: "Play a Friend",
    description: "Challenge a friend to a game",
    icon: IconUsers,
    href: "/play?mode=friend",
    iconClass: "text-sky-500",
    ringClass: "hover:border-sky-500/40",
  },
  {
    title: "Play Online",
    description: "Match with players from around the world",
    icon: IconWorld,
    href: "/play?mode=online",
    iconClass: "text-violet-500",
    ringClass: "hover:border-violet-500/40",
  },
]

function CardSkeleton() {
  return (
    <Card className="h-full border border-border/50 shadow-lg">
      <CardHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex w-full flex-col items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

export function MainPage() {
  const room = useRoom()
  const inGame =
    room.state.roomId &&
    room.state.color !== null &&
    (room.state.status === ACTIVE || room.state.status === FINISHED)
  const loading = !room.state.initialized

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-4">
          <div className="[&_svg]:-scale-x-100">
            {getPieceIcon(
              { type: KNIGHT, color: WHITE },
              { className: "size-32" }
            )}
          </div>
          <div>
            {getPieceIcon(
              { type: KNIGHT, color: BLACK },
              { className: "size-32" }
            )}
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to Chingu Chess
        </h1>
        <p className="max-w-md text-muted-foreground">
          Choose how you&apos;d like to play
        </p>
      </div>
      {loading && (
        <div className="w-full max-w-2xl">
          <CardSkeleton />
        </div>
      )}
      {!loading && inGame && (
        <Link href="/play" className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="group cursor-pointer border border-border/50 shadow-lg transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-xl">
            <CardHeader>
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <IconDeviceGamepad2 className="size-10 text-emerald-500 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
                <div className="flex flex-col gap-1.5">
                  <CardTitle>Resume Game</CardTitle>
                  <CardDescription>
                    {room.state.status === ACTIVE
                      ? "Your game is in progress — click to continue"
                      : "View your finished game"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      )}
      <div className="flex w-full max-w-2xl flex-row flex-wrap justify-center gap-4">
        {loading &&
          playModes.map((mode) => (
            <div key={mode.title} className="flex-1 basis-64">
              <CardSkeleton />
            </div>
          ))}
        {!loading &&
          playModes.map((mode) => (
            <Link
              key={mode.title}
              href={mode.href}
              className="flex-1 basis-64 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <Card
                className={`group h-full cursor-pointer border border-border/50 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl ${mode.ringClass}`}
              >
                <CardHeader>
                  <div className="flex flex-col items-center gap-4 py-4 text-center">
                    <mode.icon
                      className={`size-10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 ${mode.iconClass}`}
                    />
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
