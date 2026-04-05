import http from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { GameController } from "./controllers/gameController.js";
import { GameService } from "./services/gameService.js";
import { GameRoomHub } from "./services/gameRoomHub.js";

const gameService = new GameService();
const gameController = new GameController(gameService);
const app = createApp(gameController);

const server = http.createServer(app);
const hub = new GameRoomHub(gameService);
hub.attach(server);

server.listen(env.port, () => {
  console.log(`HTTP listening on http://localhost:${env.port}`);
  console.log(
    `WebSocket: ws://localhost:${env.port}/api/games/:gameId/ws?playerId=<yourPlayerId>`
  );
});

const shutdown = (): void => {
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
