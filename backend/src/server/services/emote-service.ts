import { WHITE, BLACK, type WebSocket } from "../types";
import type { SessionStore } from "../session/session-store";
import type { GameStore } from "../game/game-store";
import { Notifications } from "../protocol/events";
import { logger as rootLogger } from "../../logging/log";

const log = rootLogger.child({ module: "EmoteService" });

const EMOTE_COOLDOWN_MS = 7 * 1000;
const ALLOWED_EMOTES = new Set(["👍", "😅", "🤔", "🎉", "😤", "⚡"]);

export class EmoteService {
    private lastEmoteAt = new Map<string, number>();

    constructor(
        private sessions: SessionStore,
        private games: GameStore,
    ) {}

    sendEmote(ws: WebSocket, emote: string): void {
        const session = this.sessions.bySocket(ws);
        if (!session || !session.roomId || session.color === null) {
            log.warn("[ES-sendEmote-no-session]", { wsId: ws.id });
            return;
        }

        const game = this.games.get(session.roomId);
        if (!game) {
            log.warn("[ES-sendEmote-no-game]", { roomId: session.roomId });
            return;
        }

        const color = session.color;

        if (!ALLOWED_EMOTES.has(emote)) {
            log.warn("[ES-sendEmote-invalid]", { emote });
            return;
        }

        const key = `${game.id}:${color}`;
        const last = this.lastEmoteAt.get(key) ?? 0;
        if (Date.now() - last < EMOTE_COOLDOWN_MS) {
            log.info("[ES-sendEmote-cooldown]", { key });
            return;
        }
        this.lastEmoteAt.set(key, Date.now());

        const opponentColor = color === WHITE ? BLACK : WHITE;
        game.notify(opponentColor, Notifications.emoteReceived(game.id, color, emote));
        log.info("[ES-sendEmote-sent]", { roomId: game.id, from: color, emote });
    }
}
