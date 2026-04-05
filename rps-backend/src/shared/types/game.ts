export const MOVES = ["rock", "paper", "scissors"] as const;

export type Move = (typeof MOVES)[number];

export type PlayerId = string;

/** Reserved id for the AI opponent in `pvc` games (logical player 2). */
export const COMPUTER_PLAYER_ID = "computer" as const;

/** Per-player connection: WebSocket present or disconnected. */
export type PlayerSlotStatus = "online" | "offline";

export interface CompletedMatch {
  gameNumber: number;
  winner: "player1" | "player2" | "tie";
  player1RoundsWon: number;
  player2RoundsWon: number;
  finishedAt: Date;
}

type GameBase = {
  id: string;
  createdAt: Date;
  lastActivityAt: Date;
  status: "waiting" | "in_progress" | "completed";
  rounds: RoundResult[];
  /** Host display name from create; shared with all clients. */
  player1Name: string | null;
  /** Archived matches (e.g. after reset / stop). */
  matchHistory: CompletedMatch[];
};

/** PvP: two human players with server-generated `player1Id` / `player2Id`. */
export type GamePvp = GameBase & {
  type: "pvp";
  player1Id: PlayerId;
  player2Id: PlayerId | null;
  /** Joiner display name from join; shared with all clients. */
  player2Name: string | null;
  /** Keys are actual `playerId` strings from this game. */
  playerStatus: Record<string, PlayerSlotStatus>;
};

/** PvC: one human (`player1Id`) vs computer as player 2 (`COMPUTER_PLAYER_ID`). */
export type GamePvc = GameBase & {
  type: "pvc";
  player1Id: PlayerId;
  playerStatus: Record<string, PlayerSlotStatus>;
};

export type Game = GamePvp | GamePvc;

/** Second player: opponent id in PvC, or second human in PvP (`null` until they join). */
export function getSecondPlayerId(game: Game): PlayerId | null {
  if (game.type === "pvc") return COMPUTER_PLAYER_ID;
  return game.player2Id;
}

export type GameOutcome = "win" | "lose" | "draw";

export interface RoundResult {
  playerMove: Move;
  opponentMove: Move;
  outcome: GameOutcome;
}

export interface MovePayload {
  gameId: string;
  playerId: PlayerId;
  move: Move;
}

export interface GameResolvedPayload {
  gameId: string;
  playerMove: Move;
  opponentMove: Move;
  outcome: GameOutcome;
}
