"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"
import { getAudioClient, type AudioClientState } from "./client"
import { SoundContext, type Sound } from "./context"

const noop = () => {}
const cbNoop = () => () => {}
const SERVER_SNAPSHOT: AudioClientState = { ready: false }

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => getAudioClient(), [])

  const state = useSyncExternalStore(
    client?.subscribe ?? cbNoop,
    () => client?.snapshot() ?? SERVER_SNAPSHOT,
    () => SERVER_SNAPSHOT
  )

  // Preload sound buffers early to avoid deferred-play race.
  useEffect(() => {
    client?.preload()
  }, [client])

  const sound = useMemo<Sound>(
    () => ({
      ready: state.ready,
      prime: client?.prime ?? noop,
      preload: client?.preload ?? noop,
      playMove: client?.playMove ?? noop,
      playCapture: client?.playCapture ?? noop,
    }),
    [state.ready, client]
  )

  return <SoundContext.Provider value={sound}>{children}</SoundContext.Provider>
}
