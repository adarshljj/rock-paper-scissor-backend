import { Router } from "express";
import type { GameController } from "../controllers/gameController.js";
import { createGameRouter } from "./gameRoutes.js";
import { healthRouter } from "./healthRoutes.js";

export function createApiRouter(gameController: GameController): Router {
  const router = Router();
  router.get("/", (_req, res) => {
    res.json({
      service: "rock-paper-scissor-backend",
      endpoints: {
        health: "/api/health",
        games: "/api/games",
        gameWebSocket:
          "ws://localhost:PORT/api/games/:gameId/ws?playerId=<playerId>",
      },
    });
  });
  router.use("/health", healthRouter);
  router.use("/games", createGameRouter(gameController));
  return router;
}
