import type { Player } from "./player";
import type { Players } from "./players";
export class InMemoryPlayers implements Players {
  private byId = new Map<string, Player>();
  private byUsername = new Map<string, Player>();

  /**
   * C6: Looks up a player by their unique ID string.
   * Returns the player or null if unknown.
   */
  async findById(id: string): Promise<Player | null> {
    return this.byId.get(id) ?? null;
  }

  /**
   * C6: Looks up a player by their exact username string.
   * Returns the player or null if unknown.
   */
  async findByUsername(username: string): Promise<Player | null> {
    return this.byUsername.get(username) || null;
  }
  async save(player: Player): Promise<void> {
    const existingplayer = (await this.findById(player.id)) ?? null;
    if (existingplayer) {
      // C7: If the username changed, clear the old username from the map index
      if (existingplayer.username !== player.username) {
        this.byUsername.delete(existingplayer.username);
      }
    }
    this.byId.set(player.id, player);
    this.byUsername.set(player.username, player);
  }
}
