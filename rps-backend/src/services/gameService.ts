import crypto from "node:crypto";
import {
  COMPUTER_PLAYER_ID,
  MOVES,
  type CompletedMatch,
  type Game,
  type Move,
  type PlayerId,
  type RoundResult,
} from "../shared/types/game.js";
import { resolveRound } from "../shared/utils/gameLogic.js";

export type GameChangeReason =
  | "created"
  | "joined"
  | "start"
  | "stop"
  | "reset"
  | "move"
  | "player_name"
  | "presence"
  | "player_removed"
  | "deleted";

type GameChangeListener = (gameId: string, reason: GameChangeReason) => void;

export class GameService {
  private existingRooms = new Set<string>();
  private existingGames = new Map<string, Game>();
  /** PvP: collect one move per player before resolving a round. */
  private pendingMoves = new Map<string, Map<PlayerId, Move>>();
  private changeListeners = new Set<GameChangeListener>();

  onGameChange(fn: GameChangeListener): () => void {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  }

  private notify(gameId: string, reason: GameChangeReason): void {
    for (const fn of this.changeListeners) {
      try {
        fn(gameId, reason);
      } catch (e) {
        console.error("[GameService] change listener error:", e);
      }
    }
  }

  /** Persistent client id, e.g. `p1_a1b2c3d4` (store in localStorage). */
  generatePlayerId(prefix: "p1" | "p2"): string {
    const suffix = crypto.randomBytes(9).toString("base64url");
    return `${prefix}_${suffix}`;
  }

  randomMove(): Move {
    return MOVES[Math.floor(Math.random() * MOVES.length)]!;
  }

  generateRoomId(length = 7) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const bytes = crypto.randomBytes(length);

    let roomId = "";
    for (let i = 0; i < length; i++) {
      roomId += chars[bytes[i] % chars.length]!;
    }

    return roomId;
  }

  generateUniqueRoomId(): string {
    let id: string;
    do {
      id = this.generateRoomId();
    } while (this.existingRooms.has(id));
    return id;
  }

  /** One round against a random opponent (useful for demos). */
  playVsRandomOpponent(playerMove: Move): RoundResult {
    const opponentMove = this.randomMove();
    const outcome = resolveRound(playerMove, opponentMove);
    return { playerMove, opponentMove, outcome };
  }

  private summarizeRoundsToMatch(game: Game): CompletedMatch | null {
    if (game.rounds.length === 0) return null;
    let p1w = 0;
    let p2w = 0;
    for (const r of game.rounds) {
      if (r.outcome === "draw") continue;
      if (r.outcome === "win") p1w++;
      else p2w++;
    }
    let winner: CompletedMatch["winner"] = "tie";
    if (p1w > p2w) winner = "player1";
    else if (p2w > p1w) winner = "player2";
    return {
      gameNumber: game.matchHistory.length + 1,
      winner,
      player1RoundsWon: p1w,
      player2RoundsWon: p2w,
      finishedAt: new Date(),
    };
  }

  private archiveCurrentMatch(game: Game): void {
    const summary = this.summarizeRoundsToMatch(game);
    if (!summary) return;
    game.matchHistory.push(summary);
  }

  createGame(type: "pvp" | "pvc", player1Name: string | null = null): Game {
    const p1 = this.generatePlayerId("p1");
    const base = {
      id: this.generateUniqueRoomId(),
      createdAt: new Date(),
      lastActivityAt: new Date(),
      player1Name,
      matchHistory: [] as CompletedMatch[],
    };
    const game: Game =
      type === "pvp"
        ? {
            ...base,
            type: "pvp",
            player1Id: p1,
            player2Id: null,
            player2Name: null,
            playerStatus: { [p1]: "offline" },
            status: "waiting" as const,
            rounds: [],
          }
        : {
            ...base,
            type: "pvc",
            player1Id: p1,
            playerStatus: { [p1]: "offline" },
            status: "in_progress" as const,
            rounds: [],
          };

    this.existingGames.set(game.id, game);
    this.existingRooms.add(game.id);
    this.notify(game.id, "created");
    return game;
  }

  getGame(gameId: string): Game | undefined {
    return this.existingGames.get(gameId);
  }

  listGames(): Game[] {
    return [...this.existingGames.values()];
  }

  deleteGame(gameId: string): void {
    if (!this.existingGames.has(gameId)) {
      return;
    }
    this.pendingMoves.delete(gameId);
    this.notify(gameId, "deleted");
    this.existingGames.delete(gameId);
    this.existingRooms.delete(gameId);
  }

  setPlayerDisplayName(gameId: string, playerId: PlayerId, raw: string | null): void {
    const game = this.getGame(gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    const name =
      raw === null || raw === undefined
        ? null
        : raw.trim().slice(0, 48) || null;
    if (playerId === game.player1Id) {
      game.player1Name = name;
    } else if (
      game.type === "pvp" &&
      game.player2Id !== null &&
      playerId === game.player2Id
    ) {
      game.player2Name = name;
    } else {
      throw new Error("Player not in game");
    }
    game.lastActivityAt = new Date();
    this.notify(gameId, "player_name");
  }

  /**
   * Join as second human, or re-join with the same `playerId` already stored for this room.
   * Pass `existingPlayerId` from localStorage when reconnecting.
   */
  joinGame(
    gameId: string,
    player2Name: string | null = null,
    existingPlayerId: string | null = null
  ): void {
    const game = this.getGame(gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    if (game.type !== "pvp") {
      throw new Error("Only PvP games accept a second player");
    }

    if (game.player2Id !== null) {
      if (existingPlayerId !== null && existingPlayerId === game.player2Id) {
        if (player2Name != null) {
          game.player2Name = player2Name;
        }
        game.lastActivityAt = new Date();
        this.notify(gameId, "joined");
        return;
      }
      throw new Error("Game is full");
    }

    if (existingPlayerId !== null && existingPlayerId === game.player1Id) {
      throw new Error("You are already the host of this room");
    }

    const p2 = this.generatePlayerId("p2");
    game.player2Id = p2;
    game.player2Name = player2Name;
    game.playerStatus[p2] = "offline";
    game.status = "in_progress";
    game.lastActivityAt = new Date();
    this.notify(gameId, "joined");
  }

  playerConnected(gameId: string, playerId: PlayerId): void {
    const game = this.getGame(gameId);
    if (!game) return;
    if (playerId === game.player1Id) {
      game.playerStatus[playerId] = "online";
    } else if (
      game.type === "pvp" &&
      game.player2Id !== null &&
      playerId === game.player2Id
    ) {
      game.playerStatus[playerId] = "online";
    } else {
      return;
    }
    game.lastActivityAt = new Date();
    this.notify(gameId, "presence");
  }

  playerDisconnected(gameId: string, playerId: PlayerId): void {
    const game = this.getGame(gameId);
    if (!game) return;
    const isP1 = playerId === game.player1Id;
    const isP2 =
      game.type === "pvp" && game.player2Id !== null && playerId === game.player2Id;
    if (!isP1 && !isP2) return;
    game.playerStatus[playerId] = "offline";
    game.lastActivityAt = new Date();
    this.notify(gameId, "presence");
  }

  removePlayerForInactivity(gameId: string, playerId: PlayerId): void {
    const game = this.getGame(gameId);
    if (!game) return;

    if (game.type === "pvc") {
      if (playerId !== game.player1Id) return;
      this.deleteGame(gameId);
      return;
    }

    // If the host times out, close room entirely. If the joiner times out, free slot.
    if (playerId === game.player1Id) {
      this.deleteGame(gameId);
      return;
    }
    if (game.player2Id !== null && playerId === game.player2Id) {
      game.playerStatus[playerId] = "offline";
      delete game.playerStatus[playerId];
      game.player2Id = null;
      game.player2Name = null;
      game.status = "waiting";
      game.rounds = [];
      this.pendingMoves.delete(gameId);
      game.lastActivityAt = new Date();
      this.notify(gameId, "player_removed");
    }
  }

  startGame(gameId: string): void {
    const game = this.getGame(gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    if (game.status === "completed") {
      throw new Error("Game already finished");
    }
    if (game.type === "pvp" && game.player2Id === null) {
      throw new Error("Need two players");
    }
    if (game.status === "waiting") {
      game.status = "in_progress";
    }
    game.lastActivityAt = new Date();
    this.notify(gameId, "start");
  }

  stopGame(gameId: string): void {
    const game = this.getGame(gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    this.archiveCurrentMatch(game);
    game.rounds = [];
    this.pendingMoves.delete(gameId);
    game.status = "completed";
    game.lastActivityAt = new Date();
    this.notify(gameId, "stop");
  }

  resetGame(gameId: string): void {
    const game = this.getGame(gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    this.archiveCurrentMatch(game);
    game.rounds = [];
    this.pendingMoves.delete(gameId);
    game.status =
      game.type === "pvp" && game.player2Id === null ? "waiting" : "in_progress";
    game.lastActivityAt = new Date();
    this.notify(gameId, "reset");
  }

  /**
   * PvC: resolves immediately. PvP: waits for both players' moves, then resolves one round.
   * @returns The round when resolved, or `null` when PvP is waiting for the other player.
   */
  move(gameId: string, playerId: PlayerId, playerMove: Move): RoundResult | null {
    const game = this.getGame(gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    const isP1 = game.player1Id === playerId;
    const isP2 =
      game.type === "pvp"
        ? game.player2Id === playerId
        : playerId === COMPUTER_PLAYER_ID;
    if (!isP1 && !isP2) {
      throw new Error("Player not in game");
    }

    if (game.type === "pvc") {
      const opponentMove = this.randomMove();
      const outcome = resolveRound(playerMove, opponentMove);
      const round: RoundResult = { playerMove, opponentMove, outcome };
      game.rounds.push(round);
      game.lastActivityAt = new Date();
      this.notify(gameId, "move");
      return round;
    }

    if (game.player2Id === null) {
      throw new Error("Waiting for second player");
    }

    let bucket = this.pendingMoves.get(gameId);
    if (!bucket) {
      bucket = new Map();
      this.pendingMoves.set(gameId, bucket);
    }
    bucket.set(playerId, playerMove);

    const p1 = game.player1Id;
    const p2 = game.player2Id;
    if (!bucket.has(p1) || !bucket.has(p2)) {
      this.notify(gameId, "move");
      return null;
    }

    const m1 = bucket.get(p1)!;
    const m2 = bucket.get(p2)!;
    bucket.clear();
    const outcome = resolveRound(m1, m2);
    const round: RoundResult = {
      playerMove: m1,
      opponentMove: m2,
      outcome,
    };
    game.rounds.push(round);
    game.lastActivityAt = new Date();
    this.notify(gameId, "move");
    return round;
  }

  getGameStatus(gameId: string): "waiting" | "in_progress" | "completed" {
    const game = this.getGame(gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    return game.status;
  }
}
