import { logger as rootLogger } from "../../../logging/logger";
import type { Result } from "../../types/result";
import type { PlayerError } from "../../types/result";
import { err, ok } from "../../types/result";
import { PLAYER_NOT_FOUND, USERNAME_TAKEN } from "../../types/result";
import type { Player } from "./player";
import { GUEST } from "./player";
import type { PlayerStore } from "./player-store";

const log = rootLogger.child({ module: "MemoryPlayers" });

export class MemoryPlayers implements PlayerStore {
  /** pid → Player */
  private byId = new Map<string, Player>();
  /** lowercase(username) → Player (uniqueness + lookup) */
  private byUsername = new Map<string, Player>();
  /** pid → lowercase(username) at last save (detect username changes across mutations) */
  private usernameById = new Map<string, string>();

  async findById(id: string): Promise<Result<Player, PlayerError>> {
    const player = this.byId.get(id);
    if (!player) {
      log.warn("[MemoryPlayers.findById:not-found]", { id });
      return err(PLAYER_NOT_FOUND);
    }
    return ok(player);
  }

  async findByUsername(username: string): Promise<Result<Player, PlayerError>> {
    const player = this.byUsername.get(username.toLowerCase());
    if (!player) {
      log.warn("[MemoryPlayers.findByUsername:not-found]", { username });
      return err(PLAYER_NOT_FOUND);
    }
    return ok(player);
  }

  async save(player: Player): Promise<Result<void, PlayerError>> {
    const lower = player.username.toLowerCase();

    if (player.provider !== GUEST) {
      const occupant = this.byUsername.get(lower);
      if (occupant && occupant.pid !== player.pid) {
        log.warn("[MemoryPlayers.save:username-taken]", { pid: player.pid, username: player.username });
        return err(USERNAME_TAKEN);
      }
    }

    const oldLower = this.usernameById.get(player.pid);
    if (oldLower && oldLower !== lower) {
      this.byUsername.delete(oldLower);
    }

    this.byId.set(player.pid, player);
    this.usernameById.set(player.pid, lower);
    this.byUsername.set(lower, player);

    log.info("[MemoryPlayers.save:saved]", { pid: player.pid, username: player.username });
    return ok();
  }

  async delete(pid: string): Promise<Result<void, PlayerError>> {
    const player = this.byId.get(pid);
    if (!player) {
      log.warn("[MemoryPlayers.delete:not-found]", { pid });
      return err(PLAYER_NOT_FOUND);
    }
    const lower = player.username.toLowerCase();
    this.byId.delete(pid);
    this.byUsername.delete(lower);
    this.usernameById.delete(pid);
    log.info("[MemoryPlayers.delete:deleted]", { pid, username: player.username });
    return ok();
  }
}
