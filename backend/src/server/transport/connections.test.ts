import { describe, expect, it, mock } from "bun:test";
import { Connections } from "./connections";
import { CONNECTION_OPENED, CONNECTION_CLOSED } from "../protocol/events";
import { SESSION_HANDSHAKE } from "../protocol/commands";
import { WS_OPEN, type WebSocket } from "../domain/types";
import type { SessionStore } from "../session/session-store";
import type { Session } from "../session/session";
import type { Publisher } from "../bus/bus";
import type { Protocol } from "../protocol/protocol";
import type { Notification } from "../protocol/events";

describe("Connections", () => {
  /** A minimal fake WebSocket. Each call makes a distinct object, so two
   * fakes are never === even if constructed identically. */
  function makeSocket(): WebSocket {
    return {
      id: crypto.randomUUID(),
      readyState: WS_OPEN,
      send: mock(() => {}),
      close: () => {},
    };
  }

  function makeSession(overrides: Partial<Session> = {}): Session {
    return {
      token: "token-1",
      playerId: "player-1",
      ws: makeSocket(),
      roomId: null,
      color: null,
      mode: null,
      connectedAt: 0,
      disconnectedAt: null,
      ...overrides,
    };
  }

  /** A stubbable fake SessionStore — only the methods Connections touches
   * do anything by default; the rest are mocks the tests can assert on. */
  function makeSessions(overrides: Partial<SessionStore> = {}): SessionStore {
    return {
      bySocket: mock(() => null),
      byToken: mock(() => null),
      open: mock(() => makeSession()),
      resume: mock(() => null),
      resumeOrOpen: mock(() => makeSession()),
      drop: mock(() => {}),
      bind: mock(() => {}),
      prune: mock(() => {}),
      startPruning: mock(() => {}),
      stopPruning: mock(() => {}),
      ...overrides,
    };
  }

  function makePublisher(): Publisher & { emit: ReturnType<typeof mock> } {
    return { emit: mock(() => {}) };
  }

  function makeProtocol(overrides: Partial<Protocol> = {}): Protocol {
    return {
      decode: mock(() => null),
      encode: mock((event: Notification) => JSON.stringify(event)),
      ...overrides,
    };
  }

  describe("identify", () => {
    it("resumes or opens a session via the store", () => {
      const session = makeSession();
      const sessions = makeSessions({ resumeOrOpen: mock(() => session) });
      const publisher = makePublisher();
      const protocol = makeProtocol();
      const connections = new Connections(sessions, publisher, protocol);
      const ws = makeSocket();

      connections.identify(ws, "some-token");

      expect(sessions.resumeOrOpen).toHaveBeenCalledWith(ws, "some-token");
    });

    it("passes no token through when the caller supplies none", () => {
      const sessions = makeSessions();
      const publisher = makePublisher();
      const protocol = makeProtocol();
      const connections = new Connections(sessions, publisher, protocol);
      const ws = makeSocket();

      connections.identify(ws);

      expect(sessions.resumeOrOpen).toHaveBeenCalledWith(ws, undefined);
    });

    it("emits CONNECTION_OPENED with the session's playerId, the socket, and a null roomId", () => {
      const session = makeSession({ playerId: "player-42" });
      const sessions = makeSessions({ resumeOrOpen: mock(() => session) });
      const publisher = makePublisher();
      const protocol = makeProtocol();
      const connections = new Connections(sessions, publisher, protocol);
      const ws = makeSocket();

      connections.identify(ws, undefined);

      expect(publisher.emit).toHaveBeenCalledWith({
        type: CONNECTION_OPENED,
        playerId: "player-42",
        ws,
        roomId: null,
      });
    });

    it("replies on the socket with a handshake payload carrying playerId and token", () => {
      const session = makeSession({ playerId: "player-7", token: "tok-7" });
      const sessions = makeSessions({ resumeOrOpen: mock(() => session) });
      const publisher = makePublisher();
      const protocol = makeProtocol();
      const connections = new Connections(sessions, publisher, protocol);
      const ws = makeSocket();

      connections.identify(ws);

      expect(ws.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse((ws.send as any).mock.calls[0][0]);
      expect(sent).toEqual({
        type: SESSION_HANDSHAKE,
        playerId: "player-7",
        token: "tok-7",
      });
    });

    it("emits before replying to the socket", () => {
      const session = makeSession();
      const order: string[] = [];
      const sessions = makeSessions({ resumeOrOpen: mock(() => session) });
      const publisher: Publisher = {
        emit: mock(() => {
          order.push("emit");
        }),
      };
      const protocol = makeProtocol();
      const connections = new Connections(sessions, publisher, protocol);
      const ws: WebSocket = {
        id: crypto.randomUUID(),
        readyState: WS_OPEN,
        send: mock(() => {
          order.push("send");
        }),
        close: () => {},
      };

      connections.identify(ws);

      expect(order).toEqual(["emit", "send"]);
    });
  });

  describe("close", () => {
    it("does nothing when the socket has no bound session", () => {
      const sessions = makeSessions({ bySocket: mock(() => null) });
      const publisher = makePublisher();
      const protocol = makeProtocol();
      const connections = new Connections(sessions, publisher, protocol);
      const ws = makeSocket();

      connections.close(ws);

      expect(sessions.drop).not.toHaveBeenCalled();
      expect(publisher.emit).not.toHaveBeenCalled();
    });

    it("drops the session bound to the socket", () => {
      const session = makeSession();
      const sessions = makeSessions({ bySocket: mock(() => session) });
      const publisher = makePublisher();
      const protocol = makeProtocol();
      const connections = new Connections(sessions, publisher, protocol);
      const ws = makeSocket();

      connections.close(ws);

      expect(sessions.drop).toHaveBeenCalledWith(ws);
    });

    it("emits CONNECTION_CLOSED with the session's playerId, the socket, and a null roomId", () => {
      const session = makeSession({ playerId: "player-9" });
      const sessions = makeSessions({ bySocket: mock(() => session) });
      const publisher = makePublisher();
      const protocol = makeProtocol();
      const connections = new Connections(sessions, publisher, protocol);
      const ws = makeSocket();

      connections.close(ws);

      expect(publisher.emit).toHaveBeenCalledWith({
        type: CONNECTION_CLOSED,
        playerId: "player-9",
        ws,
        roomId: null,
      });
    });

    it("does not reply on the socket", () => {
      const session = makeSession();
      const sessions = makeSessions({ bySocket: mock(() => session) });
      const publisher = makePublisher();
      const protocol = makeProtocol();
      const connections = new Connections(sessions, publisher, protocol);
      const ws = makeSocket();

      connections.close(ws);

      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe("pong", () => {
    it("is a no-op: it neither drops nor emits nor sends", () => {
      const sessions = makeSessions();
      const publisher = makePublisher();
      const protocol = makeProtocol();
      const connections = new Connections(sessions, publisher, protocol);
      const ws = makeSocket();

      expect(() => connections.pong(ws)).not.toThrow();
      expect(sessions.drop).not.toHaveBeenCalled();
      expect(publisher.emit).not.toHaveBeenCalled();
      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe("send", () => {
    it("encodes the notification via the protocol and sends the result on the socket", () => {
      const sessions = makeSessions();
      const publisher = makePublisher();
      const encoded = '{"type":"fake"}';
      const protocol = makeProtocol({ encode: mock(() => encoded) });
      const connections = new Connections(sessions, publisher, protocol);
      const ws = makeSocket();
      const event = { type: "fake" } as unknown as Notification;

      connections.send(ws, event);

      expect(protocol.encode).toHaveBeenCalledWith(event);
      expect(ws.send).toHaveBeenCalledWith(encoded);
    });
  });

  describe("broadcast", () => {
    it("encodes the notification exactly once", () => {
      const sessions = makeSessions();
      const publisher = makePublisher();
      const protocol = makeProtocol();
      const connections = new Connections(sessions, publisher, protocol);
      const recipients = [makeSocket(), makeSocket(), makeSocket()];
      const event = { type: "fake" } as unknown as Notification;

      connections.broadcast(event, recipients);

      expect(protocol.encode).toHaveBeenCalledTimes(1);
    });

    it("sends the same encoded payload to every recipient", () => {
      const sessions = makeSessions();
      const publisher = makePublisher();
      const encoded = '{"type":"fake"}';
      const protocol = makeProtocol({ encode: mock(() => encoded) });
      const connections = new Connections(sessions, publisher, protocol);
      const recipients = [makeSocket(), makeSocket()];
      const event = { type: "fake" } as unknown as Notification;

      connections.broadcast(event, recipients);

      for (const ws of recipients) {
        expect(ws.send).toHaveBeenCalledWith(encoded);
      }
    });

    it("does nothing when given no recipients", () => {
      const sessions = makeSessions();
      const publisher = makePublisher();
      const protocol = makeProtocol();
      const connections = new Connections(sessions, publisher, protocol);
      const event = { type: "fake" } as unknown as Notification;

      expect(() => connections.broadcast(event, [])).not.toThrow();
      expect(protocol.encode).toHaveBeenCalledTimes(1);
    });
  });
});
