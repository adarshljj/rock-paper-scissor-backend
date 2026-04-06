import type { Server } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import type { GameChangeReason, GameService } from "./gameService.js";
import { MOVES, type PlayerId } from "../shared/types/game.js";
import type { ClientToServerMessage, ServerToClientMessage } from "../shared/types/ws.js";
import { serializeGame } from "../shared/utils/serializeGame.js";

/**
 * Tracks WebSocket clients per game and broadcasts typed events when {@link GameService} changes.
 */
export class GameRoomHub {
  private static readonly HEARTBEAT_PING_MS = 3_000;
  private static readonly HEARTBEAT_TIMEOUT_MS = 15_000;
  private readonly rooms = new Map<string, Set<WebSocket>>();
  /** Ref-count WebSocket connections per `gameId` + `playerId` so only the last close marks offline. */
  private readonly connectionCounts = new Map<string, Map<string, number>>();
  /** Last heartbeat/message per connection for inactivity timeout. */
  private readonly lastSeenBySocket = new Map<WebSocket, number>();
  /** Track sockets to game/player for timeout handling. */
  private readonly socketMeta = new Map<WebSocket, { gameId: string; playerId: PlayerId }>();
  private readonly lastRoundCount = new Map<string, number>();
  private readonly heartbeatSweep: NodeJS.Timeout;

  constructor(private readonly gameService: GameService) {
    this.gameService.onGameChange((gameId, reason) => {
      this.broadcastGameChange(gameId, reason);
    });
    this.heartbeatSweep = setInterval(
      () => this.evictInactiveConnections(),
      GameRoomHub.HEARTBEAT_PING_MS
    );
    this.heartbeatSweep.unref();
  }

  /** Attach upgrade handler to the HTTP server for `GET /api/games/:gameId/ws?playerId=`. */
  attach(server: Server): void {
    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      const host = request.headers.host ?? "localhost";
      const url = new URL(request.url ?? "/", `http://${host}`);
      const match = url.pathname.match(/^\/api\/games\/([^/]+)\/ws$/);
      if (!match) {
        socket.destroy();
        return;
      }

      const gameId = match[1]!;
      const playerId = url.searchParams.get("playerId");
      if (!playerId) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }

      const game = this.gameService.getGame(gameId);
      if (!game) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      const allowed =
        game.player1Id === playerId ||
        (game.type === "pvp" && game.player2Id === playerId);
      if (!allowed) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        this.acceptConnection(ws, gameId, playerId);
      });
    });
  }

  private incrementPresence(gameId: string, playerId: PlayerId): void {
    let m = this.connectionCounts.get(gameId);
    if (!m) {
      m = new Map();
      this.connectionCounts.set(gameId, m);
    }
    const next = (m.get(playerId) ?? 0) + 1;
    m.set(playerId, next);
    if (next === 1) {
      this.gameService.playerConnected(gameId, playerId);
    }
  }

  private decrementPresence(gameId: string, playerId: PlayerId): void {
    const m = this.connectionCounts.get(gameId);
    if (!m) return;
    const prev = m.get(playerId) ?? 0;
    if (prev <= 1) {
      m.delete(playerId);
      this.gameService.playerDisconnected(gameId, playerId);
    } else {
      m.set(playerId, prev - 1);
    }
    if (m.size === 0) {
      this.connectionCounts.delete(gameId);
    }
  }

  private acceptConnection(ws: WebSocket, gameId: string, playerId: PlayerId): void {
    let set = this.rooms.get(gameId);
    if (!set) {
      set = new Set();
      this.rooms.set(gameId, set);
    }
    set.add(ws);
    this.incrementPresence(gameId, playerId);
    this.lastSeenBySocket.set(ws, Date.now());
    this.socketMeta.set(ws, { gameId, playerId });

    const game = this.gameService.getGame(gameId);
    if (game) {
      this.send(ws, { type: "game_update", game: serializeGame(game) });
    }

    let left = false;
    const onLeave = (): void => {
      if (left) return;
      left = true;
      this.lastSeenBySocket.delete(ws);
      this.socketMeta.delete(ws);
      set!.delete(ws);
      if (set!.size === 0) {
        this.rooms.delete(gameId);
      }
      this.decrementPresence(gameId, playerId);
    };

    ws.on("message", (raw) => this.onClientMessage(ws, raw));
    ws.on("close", onLeave);
    ws.on("error", onLeave);
  }

  private onClientMessage(ws: WebSocket, raw: WebSocket.RawData): void {
    const meta = this.socketMeta.get(ws);
    if (!meta) return;
    this.lastSeenBySocket.set(ws, Date.now());

    let message: ClientToServerMessage;
    try {
      message = JSON.parse(raw.toString()) as ClientToServerMessage;
    } catch {
      return;
    }

    if (message.type === "ping") {
      return;
    }

    if (message.type === "move") {
      if (!MOVES.includes(message.move)) {
        return;
      }
      try {
        this.gameService.move(meta.gameId, meta.playerId, message.move);
      } catch {
        // Invalid state/game/player; ignore malformed or stale client actions.
      }
    }
  }

  private evictInactiveConnections(): void {
    const now = Date.now();
    for (const [ws, lastSeen] of this.lastSeenBySocket) {
      if (now - lastSeen <= GameRoomHub.HEARTBEAT_TIMEOUT_MS) continue;
      const meta = this.socketMeta.get(ws);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(4001, "heartbeat timeout");
      }
      if (!meta) continue;
      const counts = this.connectionCounts.get(meta.gameId);
      const activeConnections = counts?.get(meta.playerId) ?? 0;
      if (activeConnections <= 1) {
        this.gameService.removePlayerForInactivity(meta.gameId, meta.playerId);
      }
    }
  }

  private send(ws: WebSocket, msg: ServerToClientMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(gameId: string, msg: ServerToClientMessage): void {
    const set = this.rooms.get(gameId);
    if (!set) return;
    const raw = JSON.stringify(msg);
    for (const ws of set) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  }

  private broadcastGameChange(gameId: string, reason: GameChangeReason): void {
    if (reason === "deleted") {
      const game = this.gameService.getGame(gameId);
      if (game) {
        this.broadcast(gameId, { type: "game_update", game: serializeGame(game) });
      }
      this.closeRoom(gameId);
      return;
    }

    const game = this.gameService.getGame(gameId);
    if (!game) {
      return;
    }

    this.broadcast(gameId, { type: "game_update", game: serializeGame(game) });

    const prev = this.lastRoundCount.get(gameId) ?? 0;
    const curr = game.rounds.length;
    this.lastRoundCount.set(gameId, curr);

    if (reason === "move" && curr > prev) {
      const round = game.rounds[game.rounds.length - 1]!;
      this.broadcast(gameId, {
        type: "round_result",
        gameId,
        round,
        game: serializeGame(game),
      });
    }
  }

  private closeRoom(gameId: string): void {
    const set = this.rooms.get(gameId);
    if (!set) return;
    for (const ws of [...set]) {
      ws.close();
    }
    this.rooms.delete(gameId);
    this.lastRoundCount.delete(gameId);
  }
}
