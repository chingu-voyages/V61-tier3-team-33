import type{Player} from "./player";

//defines the actions to be done on the player storage
export interface Players {
    findById(id: string): Promise<Player | null>;
    findByUsername(username: string): Promise<Player | null>;
    save(player: Player): Promise<void>;
}