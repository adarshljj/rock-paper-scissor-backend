import { Router } from "express";
import type { GameController } from "../controllers/gameController.js";

export function createGameRouter(controller: GameController): Router {
  const router = Router();
  router.get("/", (req, res) => controller.listGames(req, res));
  router.post("/create", (req, res) => controller.createGame(req, res));
  router.get("/:gameId", (req, res) => controller.getGame(req, res));
  router.post("/:gameId/play", (req, res) => controller.move(req, res));
  router.post("/:gameId/join", (req, res) => controller.joinGame(req, res));
  router.patch("/:gameId/display-name", (req, res) =>
    controller.setPlayerDisplayName(req, res)
  );
  router.post("/:gameId/start", (req, res) => controller.startGame(req, res));
  router.post("/:gameId/stop", (req, res) => controller.stopGame(req, res));
  router.post("/:gameId/reset", (req, res) => controller.resetGame(req, res));
  router.post("/:gameId/delete", (req, res) => controller.deleteGame(req, res));
  return router;
}
