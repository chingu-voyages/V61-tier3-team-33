import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import WebSocket from 'ws';
import { EVENTS } from '../Rooms/event';

const SERVER_URL = 'ws://localhost:3500/ws';

// Type definitions
interface WebSocketMessage {
    type: string;
    [key: string]: unknown;
}

interface ConnectedMessage extends WebSocketMessage {
    userId: string;
}

interface RoomCreatedMessage extends WebSocketMessage {
    roomId: string;
    inviteLink: string;
}

interface RoomJoinedMessage extends WebSocketMessage {
    roomId: string;
    players: string[];
    whitePlayer: string;
    blackPlayer: string;
    gameStatus: string;
    fen: string;
    turn: number;
}

interface ChessStateMessage extends WebSocketMessage {
    roomId: string;
    fen: string;
    turn: number;
    inCheck: boolean;
    isOver: boolean;
    result: {
        status: string;
        winner: string | null;
        hasWinner: boolean;
        drawReason: string;
    };
}

interface ErrorMessage extends WebSocketMessage {
    message: string;
}

interface PlayerLeftMessage extends WebSocketMessage {
    playerId: string;
    gameStatus: string;
}

// Helper function with proper typing
function waitForMessage<T extends WebSocketMessage = WebSocketMessage>(ws: WebSocket): Promise<T> {
    return new Promise((resolve) => {
        ws.once("message", (raw: WebSocket.RawData) => {
            const text = typeof raw === "string" 
                ? raw 
                : raw instanceof Buffer 
                    ? raw.toString('utf-8')
                    : raw.toString();
            resolve(JSON.parse(text) as T);
        });
    });
}

// Helper to send messages with proper typing
function sendMessage(ws: WebSocket, data: Record<string, unknown>): void {
    ws.send(JSON.stringify(data));
}

// Import the server
import { app } from '../src/index';

describe('Chess WebSocket Server', () => {
    let client1: WebSocket;
    let client2: WebSocket;
    let userId1: string;
    let userId2: string;
    let roomId: string;
    let server: any;

    function connectClient(): Promise<{ ws: WebSocket; userId: string }> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(SERVER_URL);
            
            ws.on('open', () => {
                waitForMessage<ConnectedMessage>(ws).then((data) => {
                    if (data.type === EVENTS.CONNECTED) {
                        resolve({ ws, userId: data.userId });
                    } else {
                        reject(new Error(`Expected CONNECTED, got ${data.type}`));
                    }
                });
            });
            
            ws.on('error', (error) => {
                reject(error);
            });
        });
    }

    beforeAll(async () => {
        if (!server) {
            try {
                server = app.listen(3500);
                console.log('Server started on port 3500');
            } catch (error) {
                console.log('Server already running or failed to start:', error);
            }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        const client1Data = await connectClient();
        client1 = client1Data.ws;
        userId1 = client1Data.userId;
    });

    afterAll(() => {
        if (client1) client1.close();
        if (client2) client2.close();
        
        if (server) {
            try {
                server.close();
                console.log('Server closed');
            } catch (error) {
                console.log('Error closing server:', error);
            }
        }
    });

    describe('Room Creation', () => {
        it('should create a room', async () => {
            sendMessage(client1, { type: EVENTS.CREATE_ROOM });
            
            const response = await waitForMessage<RoomCreatedMessage>(client1);
            
            expect(response.type).toBe(EVENTS.ROOM_CREATED);
            expect(response.roomId).toBeDefined();
            expect(response.inviteLink).toContain('/join/');
            
            roomId = response.roomId;
        });
    });

    describe('Joining Rooms', () => {
      it('should allow a second player to join', async () => {
          const client2Data = await connectClient();
          client2 = client2Data.ws;
          userId2 = client2Data.userId;
  
          sendMessage(client2, { 
              type: EVENTS.JOIN_ROOM, 
              roomId 
          });
  
          const response = await waitForMessage<RoomJoinedMessage>(client2);
          
          expect(response.type).toBe(EVENTS.ROOM_JOINED);
          expect(response.roomId).toBe(roomId);
          expect(response.players).toContain(userId1);
          expect(response.players).toContain(userId2);
          expect(response.whitePlayer).toBe(userId1);
          expect(response.blackPlayer).toBe(userId2);
          expect(response.gameStatus).toBe('active');
          expect(response.fen).toBeDefined();
      });
  
      it('should not allow joining a full room', async () => {
          const { ws: client3 } = await connectClient();
          
          sendMessage(client3, { 
              type: EVENTS.JOIN_ROOM, 
              roomId 
          });
  
          const response = await waitForMessage<ErrorMessage>(client3);
          
          expect(response.type).toBe('ERROR');
          // ✅ Fixed: Match the actual server error message
          expect(response.message).toContain('already active');
          
          client3.close();
      });
  
      it('should not allow joining a non-existent room', async () => {
          const { ws: client3 } = await connectClient();
          
          sendMessage(client3, { 
              type: EVENTS.JOIN_ROOM, 
              roomId: 'non-existent-id' 
          });
  
          const response = await waitForMessage<ErrorMessage>(client3);
          
          expect(response.type).toBe('ERROR');
          expect(response.message).toContain('exist');
          
          client3.close();
      });
  });

    describe('Move Validation', () => {
        it('should process a legal move', async () => {
            sendMessage(client1, {
                type: EVENTS.MOVE,
                roomId,
                from: 'e2',
                to: 'e4'
            });

            const response = await waitForMessage<ChessStateMessage>(client1);
            
            expect(response.type).toBe(EVENTS.CHESS_STATE);
            expect(response.roomId).toBe(roomId);
            // ✅ FIX 3: Check for pawn at e4 position in FEN (4P3 means pawn at e4)
            expect(response.fen).toMatch(/4P3/);
            expect(response.turn).toBe(1);
            expect(response.isOver).toBe(false);
        });

        it('should reject illegal moves', async () => {
            // First make a legal move for black
            sendMessage(client2, {
                type: EVENTS.MOVE,
                roomId,
                from: 'e7',
                to: 'e5'
            });

            const response = await waitForMessage<ChessStateMessage>(client2);
            expect(response.type).toBe(EVENTS.CHESS_STATE);
            
            // Now try an illegal move
            sendMessage(client1, {
                type: EVENTS.MOVE,
                roomId,
                from: 'e4',
                to: 'e5'
            });

            const errorResponse = await waitForMessage<ErrorMessage>(client1);
            expect(errorResponse.type).toBe('ERROR');
            expect(errorResponse.message).toContain('Illegal');
        });

        it('should reject moves when it\'s not your turn', async () => {
            // After client1 moved e2-e4 and client2 moved e7-e5,
            // it's client1's turn again (White)
            // But we're going to test that client1 can't move twice in a row
            
            // First, let's make a legal move for client1 (White)
            sendMessage(client1, {
                type: EVENTS.MOVE,
                roomId,
                from: 'g1',
                to: 'f3'
            });

            // Wait for the move to be processed
            const response1 = await waitForMessage<ChessStateMessage>(client1);
            expect(response1.type).toBe(EVENTS.CHESS_STATE);
            
            // Now it's Black's turn (client2)
            // Try to make another move with client1 (White) - should fail
            sendMessage(client1, {
                type: EVENTS.MOVE,
                roomId,
                from: 'f3',
                to: 'g5'
            });

            // ✅ FIX 4: Should get ERROR because it's not client1's turn
            const errorResponse = await waitForMessage<ErrorMessage>(client1);
            expect(errorResponse.type).toBe('ERROR');
            expect(errorResponse.message).toContain('turn');
        });
    });

    describe('Game State', () => {
        it('should return current state when requested', async () => {
            sendMessage(client1, {
                type: EVENTS.CHESS_STATE,
                roomId
            });

            const response = await waitForMessage<ChessStateMessage>(client1);
            
            expect(response.type).toBe(EVENTS.CHESS_STATE);
            expect(response.roomId).toBe(roomId);
            expect(response.fen).toBeDefined();
            expect(response.turn).toBeDefined();
            expect(response.inCheck).toBeDefined();
            expect(response.isOver).toBeDefined();
            expect(response.result).toBeDefined();
            expect(response.result.status).toBeDefined();
        });
    });

    describe('Disconnect Handling', () => {
        it('should handle player disconnection', async () => {
            client2.close();
            
            const response = await waitForMessage<PlayerLeftMessage>(client1);
            
            expect(response.type).toBe(EVENTS.PLAYER_LEFT);
            expect(response.playerId).toBe(userId2);
            expect(response.gameStatus).toBe('waiting');
        });

        it('should clean up room when all players leave', async () => {
            client1.close();
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const { ws: client3 } = await connectClient();
            
            sendMessage(client3, {
                type: EVENTS.JOIN_ROOM,
                roomId
            });
            
            const response = await waitForMessage<ErrorMessage>(client3);
            expect(response.type).toBe('ERROR');
            expect(response.message).toContain('exist');
            
            client3.close();
        });
    });
});

export type {
    WebSocketMessage,
    ConnectedMessage,
    RoomCreatedMessage,
    RoomJoinedMessage,
    ChessStateMessage,
    ErrorMessage,
    PlayerLeftMessage
};
