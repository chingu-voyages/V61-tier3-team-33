import type { GameStore } from "../../store/game/game-store";
import type { PieceColor } from "../../types";
import { ConsentManager } from "../../util/consent";
import { JoinCommand } from "./join";
import { LeaveCommand } from "./leave";
import { MoveCommand } from "./move";
import { ResignCommand } from "./resign";
import { SelectPositionCommand } from "./select-position";
import { SyncCommand } from "./sync";
import { UndoCommand } from "./undo";

export class CommandRegistry {
  readonly sync: SyncCommand;
  readonly leave: LeaveCommand;
  readonly resign: ResignCommand;
  readonly move: MoveCommand;
  readonly selectPosition: SelectPositionCommand;
  readonly undo: UndoCommand;
  readonly join: JoinCommand;

  constructor(games: GameStore) {
    const consent = new ConsentManager<string, PieceColor>();
    this.undo = new UndoCommand(games, consent);
    consent.onExpire = (key) => this.undo.onConsentExpired(key);
    this.sync = new SyncCommand(games);
    this.leave = new LeaveCommand(games);
    this.resign = new ResignCommand(games);
    this.move = new MoveCommand(games);
    this.selectPosition = new SelectPositionCommand(games);
    this.join = new JoinCommand(games);
  }
}
