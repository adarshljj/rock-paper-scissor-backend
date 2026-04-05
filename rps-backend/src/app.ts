import cors from "cors";
import express from "express";
import type { GameController } from "./controllers/gameController.js";
import { createApiRouter } from "./routes/index.js";

export function createApp(gameController: GameController): express.Application {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", createApiRouter(gameController));
  return app;
}
