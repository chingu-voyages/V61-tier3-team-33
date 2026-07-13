import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import type { Command } from "../protocol/commands";
import {
  BLITZ,
  HUMAN_VS_HUMAN,
  NOT_AUTHENTICATED,
  NOT_IMPLEMENTED,
  NOT_IN_GAME,
  NOT_YOUR_TURN,
  PENDING_CONFLICT,
  Position,
  type WebSocket,
  WS_OPEN,
} from "../types";
import { Mediator } from "./mediator";

type RawMessage = Record<string, unknown>;

function makeSocket(): WebSocket {
  return {
    id: crypto.randomUUID(),
    readyState: WS_OPEN,
    send: mock(() => {}),
    close: mock(() => {}),
  };
}

function sent(ws: WebSocket): RawMessage[] {
  return (ws.send as ReturnType<typeof mock>).mock.calls.map(
    (call: unknown[]) => JSON.parse(call[0] as string) as RawMessage,
  );
}

function lastSent(ws: WebSocket): RawMessage {
  const msgs = sent(ws);
  return msgs[msgs.length - 1]!;
}

function sentOfType(ws: WebSocket, type: string): RawMessage[] {
  return sent(ws).filter((m) => m.type === type);
}

function lastSentOfType(ws: WebSocket, type: string): RawMessage | undefined {
  const msgs = sentOfType(ws, type);
  return msgs[msgs.length - 1];
}

type HandshakeReply = { type: "session:handshake"; playerId: string; token: string };
type ErrorReply = { type: "session:error"; code: string; message: string };

function handshake(mediator: Mediator, ws: WebSocket): string {
  mediator.handle(ws, { type: "session:handshake" });
  const reply = lastSent(ws) as unknown as HandshakeReply;
  expect(reply.type).toBe("session:handshake");
  expect(reply.playerId).toBeTruthy();
  expect(reply.token).toBeTruthy();
  return reply.token;
}

function handshakeWithToken(mediator: Mediator, ws: WebSocket, token: string): string {
  mediator.handle(ws, { type: "session:handshake", token });
  const reply = lastSentOfType(ws, "session:handshake") as unknown as HandshakeReply | undefined;
  return reply?.token ?? "";
}

/** Drain microtasks so any async fire-and-forget chains have settled. */
function settle(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

/**
 * Set up two players in a matched game.
 * Returns: { tokenA, tokenB, gameId }.
 */
async function matchmake(
  mediator: Mediator,
  wsA: WebSocket,
  wsB: WebSocket,
): Promise<{ tokenA: string; tokenB: string; gameId: string }> {
  const tokenA = handshake(mediator, wsA);
  mediator.handle(wsA, { type: "room:join", mode: HUMAN_VS_HUMAN, clock: BLITZ });
  await settle();

  const joinedA = lastSentOfType(wsA, "room:joined") as RawMessage | undefined;
  expect(joinedA).toBeTruthy();
  const gameId = joinedA!.roomId as string;
  expect(gameId).toBeTruthy();

  const tokenB = handshake(mediator, wsB);
  mediator.handle(wsB, { type: "room:join", mode: HUMAN_VS_HUMAN, clock: BLITZ });
  await settle();

  const joinedB = lastSentOfType(wsB, "room:joined") as RawMessage | undefined;
  expect(joinedB).toBeTruthy();
  expect(joinedB!.roomId).toBe(gameId);

  const startedA = lastSentOfType(wsA, "game:started") as RawMessage | undefined;
  const startedB = lastSentOfType(wsB, "game:started") as RawMessage | undefined;
  expect(startedA).toBeTruthy();
  expect(startedB).toBeTruthy();

  return { tokenA, tokenB, gameId };
}

const pos = Position;
// e2 (file 4, rank 1 = 33) → e4 (file 4, rank 3 = 35)
const E2 = pos(33);
const E4 = pos(35);

describe("Mediator integration", () => {
  let mediator: Mediator;

  beforeEach(() => {
    mediator = new Mediator();
  });

  afterEach(() => {
    mediator.dispose();
  });

  // ── Flow 1: Handshake (fresh) ──
  it("1: fresh socket handshake returns playerId and token", () => {
    const ws = makeSocket();
    const token = handshake(mediator, ws);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    const reply = lastSent(ws) as unknown as HandshakeReply;
    expect(reply.playerId).toMatch(/^p_/);
  });

  // ── Flow 2: Handshake with bad token (fresh session) ──
  it("2: handshake with non-existent token gets fresh session", () => {
    const ws = makeSocket();
    const token = handshakeWithToken(mediator, ws, "no-such-token");
    expect(token).toBeTruthy();
    expect(token).not.toBe("no-such-token");
  });

  // ── Flow 3: Unauthenticated command ──
  it("3: command without handshake gets NOT_AUTHENTICATED", () => {
    const ws = makeSocket();
    mediator.handle(ws, { type: "room:join", mode: HUMAN_VS_HUMAN });
    const reply = lastSent(ws) as unknown as ErrorReply;
    expect(reply.type).toBe("session:error");
    expect(reply.code).toBe(NOT_AUTHENTICATED);
  });

  // ── Flow 4: Two-player matchmaking ──
  it("4: two players matchmake into a game", async () => {
    const wsA = makeSocket();
    const wsB = makeSocket();
    const { gameId } = await matchmake(mediator, wsA, wsB);
    expect(gameId).toBeTruthy();
  });

  // ── Flow 5: White makes a legal move ──
  it("5: white moves, both players get move:made", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    // White moves e2→e4
    mediator.handle(wsW, { type: "move:make", from: E2, to: E4 });
    await settle();

    const moveW = lastSentOfType(wsW, "move:made") as RawMessage | undefined;
    const moveB = lastSentOfType(wsB, "move:made") as RawMessage | undefined;
    expect(moveW).toBeTruthy();
    expect(moveB).toBeTruthy();
    expect(moveW!.by).toBe(0); // WHITE
    expect(moveB!.by).toBe(0);
  });

  // ── Flow 6: Illegal move ──
  it("6: illegal move returns move:rejected to mover only", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    // a1→a2 (no piece at a1 can move there in starting position)
    mediator.handle(wsW, { type: "move:make", from: pos(0), to: pos(16) });
    await settle();

    const rejectedW = lastSentOfType(wsW, "move:rejected") as RawMessage | undefined;
    const rejectedB = lastSentOfType(wsB, "move:rejected");
    expect(rejectedW).toBeTruthy();
    expect(rejectedB).toBeUndefined();
    expect(rejectedW!.reason).toBeDefined();
  });

  // ── Flow 7: Resign ──
  it("7: resign ends the game", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    mediator.handle(wsW, { type: "game:resign" });
    await settle();

    const endedW = lastSentOfType(wsW, "game:ended") as RawMessage | undefined;
    const endedB = lastSentOfType(wsB, "game:ended") as RawMessage | undefined;
    expect(endedW).toBeTruthy();
    expect(endedB).toBeTruthy();
    expect(endedW!.winner).toBe(1); // BLACK wins
    expect(endedB!.winner).toBe(1);
  });

  // ── Flow 8: Undo request + accept ──
  it("8: undo request → accept applies undo", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    // White moves
    mediator.handle(wsW, { type: "move:make", from: E2, to: E4 });
    await settle();

    // White requests undo
    mediator.handle(wsW, { type: "undo:request" });
    await settle();

    const requested = lastSentOfType(wsB, "undo:requested") as RawMessage | undefined;
    expect(requested).toBeTruthy();
    expect(requested!.by).toBe(0); // WHITE requested

    // Black accepts
    mediator.handle(wsB, { type: "undo:accept" });
    await settle();

    const appliedW = lastSentOfType(wsW, "undo:applied") as RawMessage | undefined;
    const appliedB = lastSentOfType(wsB, "undo:applied") as RawMessage | undefined;
    expect(appliedW).toBeTruthy();
    expect(appliedB).toBeTruthy();
  });

  // ── Flow 9: Undo request + decline ──
  it("9: undo request → decline sends undo:declined", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    // White moves
    mediator.handle(wsW, { type: "move:make", from: E2, to: E4 });
    await settle();

    // White requests undo
    mediator.handle(wsW, { type: "undo:request" });
    await settle();

    // Black declines
    mediator.handle(wsB, { type: "undo:decline" });
    await settle();

    const declinedW = lastSentOfType(wsW, "undo:declined") as RawMessage | undefined;
    const declinedB = lastSentOfType(wsB, "undo:declined") as RawMessage | undefined;
    expect(declinedW).toBeTruthy();
    expect(declinedB).toBeTruthy();
  });

  // ── Flow 10: Second undo request from same player blocked by consent ──
  it("10: second undo request from same player returns PENDING_CONFLICT", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    // White moves
    mediator.handle(wsW, { type: "move:make", from: E2, to: E4 });
    await settle();

    // First undo request succeeds
    mediator.handle(wsW, { type: "undo:request" });
    await settle();

    // Second undo request from same side fails — consent still pending
    mediator.handle(wsW, { type: "undo:request" });
    await settle();

    const errorReply = lastSent(wsW) as unknown as ErrorReply;
    expect(errorReply.type).toBe("session:error");
    expect(errorReply.code).toBe(PENDING_CONFLICT);
  });

  // ── Flow 11: Disconnect + reconnect ──
  it("11: disconnect then reconnect with token resumes game", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    const { tokenA: tokenW } = await matchmake(mediator, wsW, wsB);

    // White disconnects
    mediator.close(wsW);
    await settle();

    const graceStarted = lastSentOfType(wsB, "grace:started") as RawMessage | undefined;
    expect(graceStarted).toBeTruthy();

    // White reconnects with a new socket — auto-rejoin fires synchronously
    // (all "async" operations are sync in practice), so room:joined may follow
    // immediately after the handshake reply.
    const wsW2 = makeSocket();
    const resumedToken = handshakeWithToken(mediator, wsW2, tokenW);
    expect(resumedToken).toBe(tokenW);
    await settle();

    // White should auto-rejoin and get room:joined
    const rejoined = lastSentOfType(wsW2, "room:joined") as RawMessage | undefined;
    expect(rejoined).toBeTruthy();
    expect(rejoined!.roomId).toBe(graceStarted!.roomId);

    // Black should get grace:cancelled
    const graceCancelled = lastSentOfType(wsB, "grace:cancelled") as RawMessage | undefined;
    expect(graceCancelled).toBeTruthy();
  });

  // ── Flow 12: Room leave ──
  it("12: leaving a room sends room:left", async () => {
    const wsA = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsA, wsB);

    mediator.handle(wsA, { type: "room:leave" });
    await settle();

    const left = lastSentOfType(wsA, "room:left") as RawMessage | undefined;
    expect(left).toBeTruthy();
  });

  // ── Flow 13: State sync ──
  it("13: state:sync sends board snapshot", async () => {
    const wsA = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsA, wsB);

    mediator.handle(wsA, { type: "state:sync" });
    await settle();

    const joined = lastSentOfType(wsA, "room:joined") as RawMessage | undefined;
    expect(joined).toBeTruthy();
    expect(joined!.state).toBeDefined();
  });

  // ── Flow 14: Select position (legal) ──
  it("14: select position of own piece returns legal destinations", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    // White selects b1 (knight) — legal: a3 (40? no, b1 is file 1 rank 0 = 8, c3 is file 2 rank 2 = 18)
    // Actually b1 is index 1*8+0 = 8. Knight jumps to a3 (file 0 rank 2 = 2), c3 (file 2 rank 2 = 18).
    const knightPos = pos(8);
    mediator.handle(wsW, { type: "position:select", position: knightPos });
    await settle();

    const accepted = lastSentOfType(wsW, "position:accept") as RawMessage | undefined;
    expect(accepted).toBeTruthy();
    expect(accepted!.position).toBe(knightPos);
    expect(Array.isArray(accepted!.moves)).toBe(true);
    expect((accepted!.moves as unknown[]).length).toBeGreaterThan(0);
  });

  // ── Flow 15: Select position of opponent's piece ──
  it("15: select opponent's piece returns position:reject", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    // White selects e7 (black pawn: file 4, rank 6 = 4*8+6 = 38)
    mediator.handle(wsW, { type: "position:select", position: pos(38) });
    await settle();

    const rejected = lastSentOfType(wsW, "position:reject") as RawMessage | undefined;
    expect(rejected).toBeTruthy();
  });

  // ── Flow 16: NOT_IN_GAME for commands that require a game ──
  it("16: commands without being in a game return NOT_IN_GAME", async () => {
    const ws = makeSocket();
    handshake(mediator, ws);

    mediator.handle(ws, { type: "move:make", from: E2, to: E4 });
    await settle();

    const reply = lastSent(ws) as unknown as ErrorReply;
    expect(reply.type).toBe("session:error");
    expect(reply.code).toBe(NOT_IN_GAME);
  });

  // ── Flow 17: Unknown command type ──
  it("17: unknown command type returns NOT_IMPLEMENTED", () => {
    const ws = makeSocket();
    handshake(mediator, ws); // must be authenticated first
    mediator.handle(ws, { type: "unknown:type" } as unknown as Command);

    const reply = lastSent(ws) as unknown as ErrorReply;
    expect(reply.type).toBe("session:error");
    expect(reply.code).toBe(NOT_IMPLEMENTED);
  });

  // ── Flow 18: Same-token, two sockets (4.2 regression) ──
  it("18: second socket with same token closes the first socket", () => {
    const ws1 = makeSocket();
    const token = handshake(mediator, ws1);

    const ws2 = makeSocket();
    const newToken = handshakeWithToken(mediator, ws2, token);
    expect(newToken).toBe(token);

    // ws1 should have been closed
    expect((ws1.close as ReturnType<typeof mock>).mock.calls.length).toBe(1);
  });

  // ── Flow 19: Pong is a no-op ──
  it("19: session:pong does not crash or send a reply", () => {
    const ws = makeSocket();
    handshake(mediator, ws);

    mediator.handle(ws, { type: "session:pong" });

    // No new messages after handshake — pong is handled internally
    const msgs = sent(ws);
    expect(msgs.length).toBe(1); // only the handshake reply
  });

  // ── Flow 20: Resign after game ended is rejected ──
  it("20: resigning a finished game returns error", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    // White resigns
    mediator.handle(wsW, { type: "game:resign" });
    await settle();

    // Black tries to resign — should fail
    mediator.handle(wsB, { type: "game:resign" });
    await settle();

    const reply = lastSentOfType(wsB, "session:error") as ErrorReply | undefined;
    expect(reply).toBeTruthy();
    // Mediator.resign returns whatever error from Game — GAME_OVER in this case
    expect(reply!.code).toBeTruthy();
  });

  // ── Flow 21: Move after game ended is rejected ──
  it("21: moving after game ended returns error", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    // White resigns
    mediator.handle(wsW, { type: "game:resign" });
    await settle();

    // White tries to move — should be rejected (no reply from mediator, but move:rejected from Game)
    mediator.handle(wsW, { type: "move:make", from: E2, to: E4 });
    await settle();

    const rejected = lastSentOfType(wsW, "move:rejected") as RawMessage | undefined;
    expect(rejected).toBeTruthy();
  });

  // ── Fuzz/concurrency flows (docs/flows.md §5) ──
  // These fire more than one command in the same synchronous tick, before
  // awaiting settle() in between, to exercise mid-processing races that the
  // happy-path flows above never hit.

  // ── Flow 22: Duplicate move from the same player, same tick ──
  it("22: two rapid moves from the same player in one tick — only the legal one lands", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    // fire twice without awaiting between calls
    mediator.handle(wsW, { type: "move:make", from: E2, to: E4 });
    mediator.handle(wsW, { type: "move:make", from: E2, to: E4 });
    await settle();

    expect(sentOfType(wsW, "move:made").length).toBe(1);
    const rejected = sentOfType(wsW, "move:rejected");
    expect(rejected.length).toBe(1);
    expect(rejected[0]!.reason).toBeDefined();

    // board integrity: black can still move legally afterward (e7-e5)
    mediator.handle(wsB, { type: "move:make", from: pos(38), to: pos(36) });
    await settle();
    expect(lastSentOfType(wsB, "move:made")).toBeTruthy();
  });

  // ── Flow 23: Simultaneous resign from both players, same tick ──
  it("23: simultaneous resign from both players — exactly one game:ended, one GAME_OVER", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    mediator.handle(wsW, { type: "game:resign" });
    mediator.handle(wsB, { type: "game:resign" });
    await settle();

    // each occupant sees the game end exactly once, never twice
    expect(sentOfType(wsW, "game:ended").length).toBe(1);
    expect(sentOfType(wsB, "game:ended").length).toBe(1);

    // exactly one of the two resign calls lost the race
    const errors = [...sentOfType(wsW, "session:error"), ...sentOfType(wsB, "session:error")];
    expect(errors.length).toBe(1);
  });

  // ── Flow 24: Resign immediately followed by move, same player, same tick ──
  it("24: move fired right after resign from the same player still ends by resignation", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    mediator.handle(wsW, { type: "game:resign" });
    mediator.handle(wsW, { type: "move:make", from: E2, to: E4 });
    await settle();

    expect(sentOfType(wsW, "game:ended").length).toBe(1);
    expect(sentOfType(wsB, "game:ended").length).toBe(1);
    const ended = lastSentOfType(wsW, "game:ended") as RawMessage | undefined;
    expect(ended!.winner).toBe(1); // BLACK wins by resignation
    expect(sentOfType(wsW, "move:made").length).toBe(0);
  });

  // ── Flow 25: close() arriving mid-join (docs/flows.md §4.9) — FIXED ──
  it("25: close() mid-join no longer orphans — session reattached and bind succeeds", async () => {
    const wsA = makeSocket();
    handshake(mediator, wsA);

    // fire join, then kill the socket before its internal await (session
    // bind) has a chance to run
    mediator.handle(wsA, { type: "room:join", mode: HUMAN_VS_HUMAN, clock: BLITZ });
    mediator.close(wsA);
    await settle();

    // the client was told it joined a room
    const joined = lastSentOfType(wsA, "room:joined") as RawMessage | undefined;
    expect(joined).toBeTruthy();

    // after the fix, the session is reattached and bound during join()'s
    // continuation, so subsequent commands are still authenticated
    mediator.handle(wsA, { type: "state:sync" });
    await settle();

    const synced = lastSentOfType(wsA, "room:joined") as RawMessage | undefined;
    expect(synced).toBeTruthy();
    expect(synced!.roomId).toBe(joined!.roomId);
  });

  // ── Flow 26: Rapid double room:join, same socket (docs/flows.md §4.10) — FIXED ──
  it("26: rapid double room:join from the same socket no longer self-matches", async () => {
    const wsA = makeSocket();
    handshake(mediator, wsA);

    mediator.handle(wsA, { type: "room:join", mode: HUMAN_VS_HUMAN, clock: BLITZ });
    mediator.handle(wsA, { type: "room:join", mode: HUMAN_VS_HUMAN, clock: BLITZ });
    await settle();

    // after the fix, the second join is rejected by the in-flight guard;
    // only one join takes effect
    const joins = sentOfType(wsA, "room:joined");
    expect(joins.length).toBe(1);
  });

  // ── Flow 27: undo accept + decline raced by the same player, same tick ──
  it("27: undo accept and decline fired together resolve to exactly one outcome", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    mediator.handle(wsW, { type: "move:make", from: E2, to: E4 });
    await settle();

    mediator.handle(wsW, { type: "undo:request" });
    await settle();

    // opponent fires accept and decline in the same tick
    mediator.handle(wsB, { type: "undo:accept" });
    mediator.handle(wsB, { type: "undo:decline" });
    await settle();

    const applied = sentOfType(wsB, "undo:applied").length;
    const declined = sentOfType(wsB, "undo:declined").length;
    expect(applied + declined).toBe(1);

    const conflicts = sentOfType(wsB, "session:error").filter((m) => m.code === PENDING_CONFLICT);
    expect(conflicts.length).toBe(1);
  });

  // ── Flow 28: Two different sockets racing room:join, same tick ──
  it("28: two different sockets racing room:join in the same tick still matchmake correctly", async () => {
    const wsA = makeSocket();
    const wsB = makeSocket();
    handshake(mediator, wsA);
    handshake(mediator, wsB);

    // no await between these two — JoinCommand.run has no internal await,
    // so both run to completion in the same synchronous tick
    mediator.handle(wsA, { type: "room:join", mode: HUMAN_VS_HUMAN, clock: BLITZ });
    mediator.handle(wsB, { type: "room:join", mode: HUMAN_VS_HUMAN, clock: BLITZ });
    await settle();

    const joinedA = lastSentOfType(wsA, "room:joined") as RawMessage | undefined;
    const joinedB = lastSentOfType(wsB, "room:joined") as RawMessage | undefined;
    expect(joinedA).toBeTruthy();
    expect(joinedB).toBeTruthy();
    expect(joinedA!.roomId).toBe(joinedB!.roomId);
    expect(lastSentOfType(wsA, "game:started")).toBeTruthy();
    expect(lastSentOfType(wsB, "game:started")).toBeTruthy();
  });

  // ── Flow 29: undo:accept racing a move, same player, same tick ──
  it("29: undo:accept racing a move from the same player serializes through the game mutex", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    mediator.handle(wsW, { type: "move:make", from: E2, to: E4 });
    await settle();

    mediator.handle(wsW, { type: "undo:request" });
    await settle();

    // black races: accept the undo AND try to move, same tick
    mediator.handle(wsB, { type: "undo:accept" });
    mediator.handle(wsB, { type: "move:make", from: pos(38), to: pos(36) }); // e7-e5
    await settle();

    // undo was dispatched first, so it claims the mutex first and reopens white's turn
    expect(lastSentOfType(wsB, "undo:applied")).toBeTruthy();

    // the queued move now finds it's white's turn again, not black's
    const rejected = lastSentOfType(wsB, "move:rejected") as RawMessage | undefined;
    expect(rejected).toBeTruthy();
    expect(rejected!.reason).toBe(NOT_YOUR_TURN);
  });

  // ── Flow 30: Undo self-cancel ──
  it("30: undo:request → undo:cancel sends undo:cancelled to both players and frees consent", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    mediator.handle(wsW, { type: "move:make", from: E2, to: E4 });
    await settle();

    mediator.handle(wsW, { type: "undo:request" });
    await settle();

    expect(lastSentOfType(wsB, "undo:requested")).toBeTruthy();

    // requester cancels
    mediator.handle(wsW, { type: "undo:cancel" });
    await settle();

    const cancelledW = lastSentOfType(wsW, "undo:cancelled") as RawMessage | undefined;
    const cancelledB = lastSentOfType(wsB, "undo:cancelled") as RawMessage | undefined;
    expect(cancelledW).toBeTruthy();
    expect(cancelledB).toBeTruthy();
    expect(cancelledW!.roomId).toBeTruthy();
  });

  // ── Flow 31: New move invalidates pending undo (rule 13) ──
  it("31: opponent playing a new move invalidates pending undo request", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    mediator.handle(wsW, { type: "move:make", from: E2, to: E4 });
    await settle();

    // White requests undo
    mediator.handle(wsW, { type: "undo:request" });
    await settle();

    expect(lastSentOfType(wsB, "undo:requested")).toBeTruthy();

    // Black ignores the request and moves instead
    mediator.handle(wsB, { type: "move:make", from: pos(38), to: pos(36) }); // e7-e5
    await settle();

    // The move lands
    expect(lastSentOfType(wsB, "move:made")).toBeTruthy();

    // White should get undo:invalidated (requester-only notification)
    const invalidatedW = lastSentOfType(wsW, "undo:invalidated") as RawMessage | undefined;
    expect(invalidatedW).toBeTruthy();

    // Black should NOT get undo:invalidated (it's requester-only)
    const invalidatedB = lastSentOfType(wsB, "undo:invalidated");
    expect(invalidatedB).toBeUndefined();

    // Consent slot should now be free — a new undo request should succeed
    // (after the ratchet advances with another move, but we just moved to moveSeq 2)
    // After Black's move, it's White's turn. Black (who just moved) can request undo.
    // moveSeq is 2 after two moves, lastResolvedSeq is 1 (set by invalidate) → ratchet passes.
    mediator.handle(wsB, { type: "undo:request" });
    await settle();

    const requested2 = lastSentOfType(wsW, "undo:requested") as RawMessage | undefined;
    expect(requested2).toBeTruthy();
    expect(requested2!.by).toBe(1); // BLACK requested
  });

  // ── Flow 32: Checkmate broadcasts game:ended (undo-rules.md rule 9 fix) ──
  it("32: checkmate ends the game and both players get game:ended", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    // Fool's mate: 1.f3 e5 2.g4 Qh4#
    const F2 = pos(41);
    const F3 = pos(42);
    const E7 = pos(38);
    const E5 = pos(36);
    const G2 = pos(49);
    const G4 = pos(51);
    const D8 = pos(31);
    const H4 = pos(59);

    mediator.handle(wsW, { type: "move:make", from: F2, to: F3 });
    await settle();
    mediator.handle(wsB, { type: "move:make", from: E7, to: E5 });
    await settle();
    mediator.handle(wsW, { type: "move:make", from: G2, to: G4 });
    await settle();

    mediator.handle(wsB, { type: "move:make", from: D8, to: H4 });
    await settle();

    expect(lastSentOfType(wsB, "move:made")).toBeTruthy();

    const endedW = lastSentOfType(wsW, "game:ended") as RawMessage | undefined;
    const endedB = lastSentOfType(wsB, "game:ended") as RawMessage | undefined;
    expect(endedW).toBeTruthy();
    expect(endedB).toBeTruthy();
    expect(endedW!.winner).toBe(1); // BLACK delivers mate
    expect(endedB!.winner).toBe(1);
  });

  // ── Flow 33: Undo:cancel (requester) racing undo:decline (opponent), same tick ──
  it("33: undo:cancel from requester and undo:decline from opponent in the same tick resolve to exactly one outcome", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    mediator.handle(wsW, { type: "move:make", from: E2, to: E4 });
    await settle();

    mediator.handle(wsW, { type: "undo:request" });
    await settle();

    expect(lastSentOfType(wsB, "undo:requested")).toBeTruthy();

    // same tick: requester cancels, opponent declines
    mediator.handle(wsW, { type: "undo:cancel" });
    mediator.handle(wsB, { type: "undo:decline" });
    await settle();

    // exactly one of the two transitions won — either cancelled or declined
    const cancelled = sentOfType(wsW, "undo:cancelled").length;
    const declined = sentOfType(wsW, "undo:declined").length;
    expect(cancelled + declined).toBe(1);

    // the other got PENDING_CONFLICT
    const conflicts = [...sentOfType(wsW, "session:error"), ...sentOfType(wsB, "session:error")].filter(
      (m) => m.code === PENDING_CONFLICT,
    );
    expect(conflicts.length).toBe(1);

    // consent slot is freed — no more responses possible
    mediator.handle(wsB, { type: "undo:decline" });
    await settle();
    const lateConflict = lastSentOfType(wsB, "session:error") as ErrorReply | undefined;
    expect(lateConflict?.code).toBe(PENDING_CONFLICT);
  });

  // ── Flow 34: Double close on the same socket is idempotent ──
  it("34: double close on the same socket does not crash or send duplicate grace:started", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    mediator.close(wsW);
    mediator.close(wsW);
    await settle();

    // opponent is notified of grace exactly once
    const graceStarted = sentOfType(wsB, "grace:started");
    expect(graceStarted.length).toBe(1);

    // second close was a no-op — only one drop log
  });

  // ── Flow 35: Undo:request from the wrong player returns NOT_YOUR_TURN (rule 3) ──
  it("35: undo:request from the player whose turn it is (not the mover) returns NOT_YOUR_TURN", async () => {
    const wsW = makeSocket();
    const wsB = makeSocket();
    await matchmake(mediator, wsW, wsB);

    // White moves e2→e4. Now it's Black's turn.
    // The last mover is WHITE, so only WHITE may request undo (rule 3).
    mediator.handle(wsW, { type: "move:make", from: E2, to: E4 });
    await settle();

    // Black (whose turn it is) tries to request undo — should fail
    mediator.handle(wsB, { type: "undo:request" });
    await settle();

    const errorReply = lastSentOfType(wsB, "session:error") as ErrorReply | undefined;
    expect(errorReply).toBeTruthy();
    expect(errorReply!.code).toBe(NOT_YOUR_TURN);

    // White (the last mover) can still request
    mediator.handle(wsW, { type: "undo:request" });
    await settle();
    expect(lastSentOfType(wsB, "undo:requested")).toBeTruthy();
  });

  // ── Flow 36: Same-token simultaneous handshake from two sockets ──
  it("36: two sockets handshaking with the same token in the same tick — no crash, both get a reply", () => {
    const ws1 = makeSocket();
    const token = handshake(mediator, ws1);

    const ws2 = makeSocket();
    const ws3 = makeSocket();

    // both try to resume with the same token simultaneously
    mediator.handle(ws2, { type: "session:handshake", token });
    mediator.handle(ws3, { type: "session:handshake", token });

    // each gets a handshake reply
    const reply2 = lastSentOfType(ws2, "session:handshake") as unknown as HandshakeReply | undefined;
    const reply3 = lastSentOfType(ws3, "session:handshake") as unknown as HandshakeReply | undefined;
    expect(reply2).toBeTruthy();
    expect(reply3).toBeTruthy();

    // ws1 gets closed at least once (by whichever resume ran first)
    expect((ws1.close as ReturnType<typeof mock>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Bug reproductions (docs/flows.md §4.9, §4.10)
//
// Unlike flows 25/26 above (which document *current* buggy behavior as the
// expected/passing outcome), these assert what SHOULD happen. They are
// expected to FAIL against the code as it stands today — a failing run
// here is the proof that 4.9/4.10 are real bugs, not just observations.
// Once the underlying fix lands, these should go green with no edits.
// ────────────────────────────────────────────────────────────────────────
describe("Mediator bug reproductions (expect red until fixed)", () => {
  let mediator: Mediator;

  beforeEach(() => {
    mediator = new Mediator();
  });

  afterEach(() => {
    mediator.dispose();
  });

  // ── Bug 4.9: close() mid-join() orphans the seat ──
  it("4.9: reconnecting after a mid-join close should resume the seat the client was told about", async () => {
    const wsA = makeSocket();
    const tokenA = handshake(mediator, wsA);

    // fire join, then kill the socket before its internal await (session
    // bind) has a chance to run — see flow 25 for the current (buggy) trace
    mediator.handle(wsA, { type: "room:join", mode: HUMAN_VS_HUMAN, clock: BLITZ });
    mediator.close(wsA);
    await settle();

    const joined = lastSentOfType(wsA, "room:joined") as RawMessage | undefined;
    expect(joined).toBeTruthy(); // client was told it joined a room

    // a reconnect with the very same token should land back in that room —
    // not come back as an authenticated-but-roomless fresh session
    const wsA2 = makeSocket();
    const resumedToken = handshakeWithToken(mediator, wsA2, tokenA);
    expect(resumedToken).toBe(tokenA);
    await settle();

    const rejoined = lastSentOfType(wsA2, "room:joined") as RawMessage | undefined;
    expect(rejoined).toBeTruthy();
    expect(rejoined?.roomId).toBe(joined!.roomId);
  });

  // ── Bug 4.10: rapid double room:join self-matches both colors ──
  it("4.10: rapid double room:join should never seat the same socket as both colors", async () => {
    const wsA = makeSocket();
    handshake(mediator, wsA);

    // fired with zero gap — see flow 26 for the current (buggy) trace
    mediator.handle(wsA, { type: "room:join", mode: HUMAN_VS_HUMAN, clock: BLITZ });
    mediator.handle(wsA, { type: "room:join", mode: HUMAN_VS_HUMAN, clock: BLITZ });
    await settle();

    // exactly one join should have taken effect for this socket
    expect(sentOfType(wsA, "room:joined").length).toBe(1);
  });
});
