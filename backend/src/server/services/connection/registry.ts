import type { Publisher } from "../../events/hub";
import type { SessionStore } from "../../store/session/session-store";
import { Grace } from "../../util/grace";
import { CloseCommand } from "./close";
import { IdentifyCommand } from "./identify";
import { PongCommand } from "./pong";

const GRACE_TIMEOUT_MS = 30 * 1000;

export class ConnectionRegistry {
  readonly identify: IdentifyCommand;
  readonly close: CloseCommand;
  readonly pong: PongCommand;

  constructor(sessions: SessionStore, publisher: Publisher, graceTimeoutMs = GRACE_TIMEOUT_MS) {
    const grace = new Grace();
    this.identify = new IdentifyCommand(sessions, publisher, grace);
    this.close = new CloseCommand(sessions, publisher, grace, graceTimeoutMs);
    this.pong = new PongCommand();
  }
}
