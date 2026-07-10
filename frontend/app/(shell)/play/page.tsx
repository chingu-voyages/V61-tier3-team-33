import { PlayPage } from "@/components/play/PlayPage"
import { Suspense } from "react"

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PlayPage />
    </Suspense>
  )
}
