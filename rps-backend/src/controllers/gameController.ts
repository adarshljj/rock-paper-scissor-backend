import type { Request, Response } from "express";
import type { GameService } from "../services/gameService.js";
import { isValidMove } from "../shared/utils/gameLogic.js";
import { serializeGame } from "../shared/utils/serializeGame.js";

function normalizeDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().slice(0, 48);
  return t.length > 0 ? t : null;
}

function gameHttpError(res: Response, e: unknown): void {
  if (e instanceof Error && e.message === "Game not found") {
    res.status(404).json({ error: e.message });
    return;
  }
  if (e instanceof Error) {
    res.status(400).json({ error: e.message });
    return;
  }
  res.status(500).json({ error: "Internal error" });
}

export class GameController {
  constructor(private readonly gameService: GameService) {}

  listGames = async (_req: Request, res: Response): Promise<void> => {
    res.json({ games: this.gameService.listGames() });
  };

  getGame = async (req: Request, res: Response): Promise<void> => {
    const gameId = req.params.gameId!;
    const game = this.gameService.getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    res.json(game);
  };

  createGame = async (req: Request, res: Response): Promise<void> => {
    if (!req.body.type || typeof req.body.type !== "string") {
      res.status(400).json({ error: "type is required" });
      return;
    }
    if (req.body.type !== "pvp" && req.body.type !== "pvc") {
      res.status(400).json({ error: "Unsupported game type" });
      return;
    }
    const game = this.gameService.createGame(
      req.body.type,
      normalizeDisplayName(req.body.playerName)
    );
    res.status(201).json({
      roomId: game.id,
      playerId: game.player1Id,
      game: serializeGame(game),
    });
  };

  setPlayerDisplayName = async (req: Request, res: Response): Promise<void> => {
    const gameId = req.params.gameId!;
    const { playerId, playerName } = req.body as {
      playerId?: string;
      playerName?: unknown;
    };
    if (!playerId || typeof playerId !== "string") {
      res.status(400).json({ error: "playerId is required" });
      return;
    }
    const name =
      playerName === undefined || playerName === null
        ? null
        : typeof playerName === "string"
          ? playerName
          : String(playerName);
    try {
      this.gameService.setPlayerDisplayName(gameId, playerId, name);
      res.json(this.gameService.getGame(gameId));
    } catch (e) {
      gameHttpError(res, e);
    }
  };

  joinGame = async (req: Request, res: Response): Promise<void> => {
    const gameId = req.params.gameId!;
    const body = req.body as { playerName?: unknown; playerId?: unknown };
    const existingPlayerId =
      typeof body.playerId === "string" && body.playerId.length > 0
        ? body.playerId
        : null;
    try {
      this.gameService.joinGame(
        gameId,
        normalizeDisplayName(body.playerName),
        existingPlayerId
      );
      const game = this.gameService.getGame(gameId)!;
      res.json({
        roomId: game.id,
        playerId: game.type === "pvp" ? game.player2Id! : null,
        game: serializeGame(game),
      });
    } catch (e) {
      gameHttpError(res, e);
    }
  };

  move = async (req: Request, res: Response): Promise<void> => {
    const gameId = req.params.gameId!;
    const { playerId, move } = req.body as { playerId?: string; move?: unknown };
    if (!playerId || typeof playerId !== "string") {
      res.status(400).json({ error: "playerId is required" });
      return;
    }
    if (!isValidMove(move)) {
      res.status(400).json({ error: "move must be rock, paper, or scissors" });
      return;
    }
    try {
      const round = this.gameService.move(gameId, playerId, move);
      if (round) {
        res.json({ ok: true, round });
      } else {
        res.json({ ok: true, waiting: true });
      }
    } catch (e) {
      gameHttpError(res, e);
    }
  };

  startGame = async (req: Request, res: Response): Promise<void> => {
    const gameId = req.params.gameId!;
    try {
      this.gameService.startGame(gameId);
      res.json(this.gameService.getGame(gameId));
    } catch (e) {
      gameHttpError(res, e);
    }
  };

  stopGame = async (req: Request, res: Response): Promise<void> => {
    const gameId = req.params.gameId!;
    try {
      this.gameService.stopGame(gameId);
      res.json(this.gameService.getGame(gameId));
    } catch (e) {
      gameHttpError(res, e);
    }
  };

  resetGame = async (req: Request, res: Response): Promise<void> => {
    const gameId = req.params.gameId!;
    try {
      this.gameService.resetGame(gameId);
      res.json(this.gameService.getGame(gameId));
    } catch (e) {
      gameHttpError(res, e);
    }
  };

  deleteGame = async (req: Request, res: Response): Promise<void> => {
    const gameId = req.params.gameId!;
    const game = this.gameService.getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    this.gameService.deleteGame(gameId);
    res.status(204).send();
  };
}
