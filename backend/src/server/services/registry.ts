import type { Publisher } from "../events/hub";
import type { GameReader, GameStore } from "../store/game/game-store";
import type { SessionStore } from "../store/session/session-store";
import { ConnectionRegistry } from "./connection/registry";
import { CommandRegistry } from "./game/registry";
import { SendCommand } from "./emote/send";

export class ServiceRegistry {
  readonly game: CommandRegistry;
  readonly emote: SendCommand;
  readonly connection: ConnectionRegistry;

  constructor(sessions: SessionStore, hub: Publisher, games: GameStore) {
    this.game = new CommandRegistry(games);
    this.emote = new SendCommand(games as GameReader);
    this.connection = new ConnectionRegistry(sessions, hub);
  }
}
