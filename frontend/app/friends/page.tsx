import { FriendSearch } from "@/components/friends/FriendSearch";
import { PendingRequests } from "@/components/friends/PendingRequests";
import { FriendsList } from "@/components/friends/FriendsList";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { getPieceIcon } from "@/components/pieces";
import { WHITE, BLACK, KING, QUEEN } from "@/core/piece";

export default function FriendsPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-6">
      {/* Hero */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-6">
          <div className="[&_svg]:-scale-x-100">
            {getPieceIcon(
              { type: KING, color: WHITE },
              { className: "size-28" }
            )}
          </div>

          <div>
            {getPieceIcon(
              { type: QUEEN, color: BLACK },
              { className: "size-28" }
            )}
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-tight">
          Friends
        </h1>

        <p className="max-w-md text-muted-foreground">
          Build your chess network, send friend requests, and challenge
          your friends anytime.
        </p>
      </div>

      {/* Add Friend */}
      <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-300">
        <Card className="border border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle>Add a Friend</CardTitle>
            <CardDescription>
              Search using a player's ID and send a friend request.
            </CardDescription>
          </CardHeader>

          <div className="px-6 pb-6">
            <FriendSearch />
          </div>
        </Card>
      </div>

      {/* Two column layout */}
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-2">
        <Card className="border border-border/50 shadow-lg transition-all hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-xl">
          <CardHeader>
            <CardTitle>Pending Requests</CardTitle>
            <CardDescription>
              Accept or block incoming friend requests.
            </CardDescription>
          </CardHeader>

          <div className="px-6 pb-6">
            <PendingRequests />
          </div>
        </Card>

        <Card className="border border-border/50 shadow-lg transition-all hover:-translate-y-0.5 hover:border-violet-500/40 hover:shadow-xl">
          <CardHeader>
            <CardTitle>Your Friends</CardTitle>
            <CardDescription>
              Manage everyone you've connected with.
            </CardDescription>
          </CardHeader>

          <div className="px-6 pb-6">
            <FriendsList />
          </div>
        </Card>
      </div>
    </main>
  );
}