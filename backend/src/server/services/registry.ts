import type { Publisher } from "../events/hub";
import type { GameStore } from "../store/game/game-store";
import type { SessionStore } from "../store/session/session-store";
import { ConnectionRegistry } from "./connection/registry";
import { CommandRegistry } from "./game/registry";

export class ServiceRegistry {
  readonly game: CommandRegistry;
  readonly connection: ConnectionRegistry;

  constructor(sessions: SessionStore, hub: Publisher, games: GameStore) {
    this.game = new CommandRegistry(games);
    this.connection = new ConnectionRegistry(sessions, hub);
  }
}
