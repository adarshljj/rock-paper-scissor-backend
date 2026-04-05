import type { GameOutcome, Move } from "../types/game.js";

const beats: Record<Move, Move> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

export function resolveRound(player: Move, opponent: Move): GameOutcome {
  if (player === opponent) return "draw";
  return beats[player] === opponent ? "win" : "lose";
}

export function isValidMove(value: unknown): value is Move {
  return value === "rock" || value === "paper" || value === "scissors";
}
