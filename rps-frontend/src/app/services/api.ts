/**
 * HTTP + WebSocket client for rps-backend (`/api/games/*`).
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

/** localStorage keys — same contract as server-issued ids in create/join responses. */
export const STORAGE_PLAYER_ID = "playerId";
export const STORAGE_ROOM_ID = "rps_roomId";

export function persistPlayerSession(roomId: string, playerId: string): void {
  localStorage.setItem(STORAGE_PLAYER_ID, playerId);
  localStorage.setItem(STORAGE_ROOM_ID, roomId);
}

export type GameMode = "pvp" | "pvc";
export type Choice = "rock" | "paper" | "scissors" | null;
export type GameStatus = "waiting" | "playing" | "finished";

export interface Player {
  id: string;
  name: string;
  isComputer: boolean;
}

export interface Round {
  roundNumber: number;
  player1Choice: Choice;
  player2Choice: Choice;
  winner: "player1" | "player2" | "tie" | null;
}

/** From server `playerStatus`; `ai` = PvC opponent (not WebSocket-tracked). */
export type PlayerPresence = "online" | "offline" | "waiting" | "ai";

export interface GameState {
  roomId: string;
  gameMode: GameMode;
  status: GameStatus;
  player1: Player;
  player2: Player | null;
  currentRound: number;
  rounds: Round[];
  player1RoundsWon: number;
  player2RoundsWon: number;
  gamesHistory: GameResult[];
  player1Presence: PlayerPresence;
  player2Presence: PlayerPresence;
}

export interface GameResult {
  gameNumber: number;
  winner: "player1" | "player2" | "tie";
  player1RoundsWon: number;
  player2RoundsWon: number;
}

/** Backend JSON shape (dates as ISO strings). */
export interface SerializedGame {
  id: string;
  createdAt: string;
  lastActivityAt: string;
  status: "waiting" | "in_progress" | "completed";
  type: GameMode;
  player1Id: string;
  /** Host display name from create; visible to both clients. */
  player1Name?: string | null;
  /** Absent on PvC games from the API. */
  player2Id?: string | null;
  /** Joiner display name (PvP); visible to both clients once set. */
  player2Name?: string | null;
  /** Keys are server-generated player ids. */
  playerStatus?: Record<string, "online" | "offline">;
  matchHistory?: BackendCompletedMatch[];
  rounds: BackendRound[];
}

interface BackendCompletedMatch {
  gameNumber: number;
  winner: "player1" | "player2" | "tie";
  player1RoundsWon: number;
  player2RoundsWon: number;
  finishedAt: string;
}

interface BackendRound {
  playerMove: "rock" | "paper" | "scissors";
  opponentMove: "rock" | "paper" | "scissors";
  outcome: "win" | "lose" | "draw";
}

const COMPUTER_ID = "computer";
/** PvC opponent label (no `player2Name` on server for PVC). */
const COMPUTER_DISPLAY_NAME = "Computer";
const MAX_ROUNDS = 5;

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

function buildGameResultFromWins(
  gameNumber: number,
  p1w: number,
  p2w: number
): GameResult {
  let winner: GameResult["winner"] = "tie";
  if (p1w > p2w) winner = "player1";
  else if (p2w > p1w) winner = "player2";
  return {
    gameNumber,
    winner,
    player1RoundsWon: p1w,
    player2RoundsWon: p2w,
  };
}

/** Maps server snapshot to UI state. Names come only from `SerializedGame` (synced via HTTP + WebSocket). */
export function mapBackendToGameState(game: SerializedGame): GameState {
  const ps = game.playerStatus ?? {};
  const p1Name = game.player1Name ?? "";
  const p2Id = game.type === "pvc" ? null : game.player2Id ?? null;
  const p2Name =
    game.type === "pvc"
      ? COMPUTER_DISPLAY_NAME
      : p2Id
        ? game.player2Name ?? ""
        : "";

  const player1Presence = (ps[game.player1Id] as PlayerPresence | undefined) ?? "offline";
  const player2Presence: PlayerPresence =
    game.type === "pvc"
      ? "ai"
      : p2Id
        ? (ps[p2Id] as PlayerPresence | undefined) ?? "offline"
        : "waiting";

  const rounds: Round[] = game.rounds.map((r, i) => {
    let winner: Round["winner"] = null;
    if (r.outcome === "draw") winner = "tie";
    else if (r.outcome === "win") winner = "player1";
    else winner = "player2";

    return {
      roundNumber: i + 1,
      player1Choice: r.playerMove,
      player2Choice: r.opponentMove,
      winner,
    };
  });

  let p1Wins = 0;
  let p2Wins = 0;
  for (const r of rounds) {
    if (r.winner === "player1") p1Wins++;
    else if (r.winner === "player2") p2Wins++;
  }

  const roundCount = rounds.length;
  let status: GameStatus;
  if (game.status === "completed") {
    status = "finished";
  } else if (game.status === "waiting") {
    status = "waiting";
  } else {
    status = roundCount >= MAX_ROUNDS ? "finished" : "playing";
  }

  const currentRound =
    status === "finished"
      ? Math.min(MAX_ROUNDS, Math.max(1, roundCount))
      : Math.min(MAX_ROUNDS, roundCount + 1);

  const player1: Player = {
    id: game.player1Id,
    name: p1Name,
    isComputer: false,
  };

  const player2: Player | null =
    game.type === "pvc"
      ? {
          id: COMPUTER_ID,
          name: p2Name,
          isComputer: true,
        }
      : p2Id
        ? {
            id: p2Id,
            name: p2Name,
            isComputer: false,
          }
        : null;

  const archived: GameResult[] = (game.matchHistory ?? []).map((m) => ({
    gameNumber: m.gameNumber,
    winner: m.winner,
    player1RoundsWon: m.player1RoundsWon,
    player2RoundsWon: m.player2RoundsWon,
  }));

  let gamesHistory = [...archived];
  if (status === "finished" && roundCount > 0) {
    const maxNum = gamesHistory.reduce((mx, g) => Math.max(mx, g.gameNumber), 0);
    const nextNum = maxNum + 1;
    if (!gamesHistory.some((g) => g.gameNumber === nextNum)) {
      gamesHistory.push(buildGameResultFromWins(nextNum, p1Wins, p2Wins));
    }
  }

  return {
    roomId: game.id,
    gameMode: game.type,
    status,
    player1,
    player2,
    currentRound,
    rounds,
    player1RoundsWon: p1Wins,
    player2RoundsWon: p2Wins,
    gamesHistory,
    player1Presence,
    player2Presence,
  };
}

export async function fetchGame(roomId: string): Promise<SerializedGame> {
  const res = await fetch(apiUrl(`/api/games/${encodeURIComponent(roomId)}`));
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return (await res.json()) as SerializedGame;
}

export async function createRoom(
  playerName: string,
  gameMode: GameMode
): Promise<{ roomId: string; playerId: string; game: SerializedGame }> {
  const res = await fetch(apiUrl("/api/games/create"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: gameMode, playerName }),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as {
    roomId: string;
    playerId: string;
    game: SerializedGame;
  };
  persistPlayerSession(data.roomId, data.playerId);
  return {
    roomId: data.roomId,
    playerId: data.playerId,
    game: data.game,
  };
}

export async function joinRoom(
  roomId: string,
  playerName: string
): Promise<{ playerId: string; game: SerializedGame }> {
  const body: { playerName: string; playerId?: string } = { playerName };
  const storedRoom = localStorage.getItem(STORAGE_ROOM_ID);
  const storedPid = localStorage.getItem(STORAGE_PLAYER_ID);
  if (storedRoom === roomId && storedPid) {
    body.playerId = storedPid;
  }
  const res = await fetch(apiUrl(`/api/games/${encodeURIComponent(roomId)}/join`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as {
    roomId: string;
    playerId: string;
    game: SerializedGame;
  };
  persistPlayerSession(data.roomId, data.playerId);
  return { playerId: data.playerId, game: data.game };
}

export async function submitChoice(
  roomId: string,
  playerId: string,
  choice: Choice
): Promise<SerializedGame> {
  if (!choice) {
    throw new Error("Invalid choice");
  }
  const res = await fetch(
    apiUrl(`/api/games/${encodeURIComponent(roomId)}/play`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, move: choice }),
    }
  );
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  await res.json();
  return fetchGame(roomId);
}

export async function startNewGame(roomId: string): Promise<SerializedGame> {
  const res = await fetch(
    apiUrl(`/api/games/${encodeURIComponent(roomId)}/reset`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  await res.json();
  return fetchGame(roomId);
}

export async function updateDisplayName(
  roomId: string,
  playerId: string,
  playerName: string
): Promise<SerializedGame> {
  const res = await fetch(
    apiUrl(`/api/games/${encodeURIComponent(roomId)}/display-name`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, playerName }),
    }
  );
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return (await res.json()) as SerializedGame;
}

type WsMessage =
  | { type: "game_update"; game: SerializedGame }
  | {
      type: "round_result";
      gameId: string;
      game: SerializedGame;
      round?: unknown;
    };

export function subscribeToRoom(
  roomId: string,
  playerId: string,
  onGame: (game: SerializedGame) => void
): () => void {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(
    `${protocol}//${window.location.host}/api/games/${encodeURIComponent(roomId)}/ws?playerId=${encodeURIComponent(playerId)}`
  );

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string) as WsMessage;
      if (msg.type === "game_update" || msg.type === "round_result") {
        onGame(msg.game);
      }
    } catch {
      /* ignore */
    }
  };

  return () => {
    ws.onmessage = null;
    ws.onerror = null;
    ws.onopen = null;
    ws.onclose = null;
    if (
      ws.readyState === WebSocket.OPEN ||
      ws.readyState === WebSocket.CONNECTING
    ) {
      ws.close(1000, "client closed");
    }
  };
}
