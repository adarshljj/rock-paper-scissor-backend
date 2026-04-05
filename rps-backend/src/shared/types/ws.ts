import type { CompletedMatch, Game, RoundResult } from "./game.js";

export type SerializedCompletedMatch = Omit<CompletedMatch, "finishedAt"> & {
  finishedAt: string;
};

/** JSON-safe game snapshot (dates as ISO strings). */
export type SerializedGame = Omit<
  Game,
  "createdAt" | "lastActivityAt" | "matchHistory"
> & {
  createdAt: string;
  lastActivityAt: string;
  matchHistory: SerializedCompletedMatch[];
};

/** Server → client WebSocket messages (single connection, discriminated by `type`). */
export type ServerToClientMessage =
  | {
      type: "game_update";
      game: SerializedGame;
    }
  | {
      type: "round_result";
      gameId: string;
      round: RoundResult;
      game: SerializedGame;
    };
