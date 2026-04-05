import type { Game } from "../types/game.js";
import type { SerializedGame } from "../types/ws.js";

export function serializeGame(game: Game): SerializedGame {
  return {
    ...game,
    createdAt: game.createdAt.toISOString(),
    lastActivityAt: game.lastActivityAt.toISOString(),
    matchHistory: game.matchHistory.map((m) => ({
      ...m,
      finishedAt: m.finishedAt.toISOString(),
    })),
  };
}
