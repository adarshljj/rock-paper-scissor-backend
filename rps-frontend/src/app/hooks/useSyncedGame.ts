import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createRoom,
  fetchGame,
  joinRoom,
  mapBackendToGameState,
  STORAGE_PLAYER_ID,
  STORAGE_ROOM_ID,
  startNewGame as resetGameApi,
  submitChoice as playMoveApi,
  subscribeToRoom,
  updateDisplayName as patchDisplayNameApi,
  type Choice,
  type GameMode,
  type GameState,
  type SerializedGame,
} from "../services/api";

export interface UseSyncedGameResult {
  gameState: GameState | null;
  playerId: string;
  ready: boolean;
  loading: boolean;
  error: string;
  clearError: () => void;
  createGame: (mode: GameMode, playerName: string) => Promise<void>;
  joinGame: (roomId: string, playerName: string) => Promise<void>;
  submitChoice: (choice: Choice) => Promise<void>;
  startNewGame: () => Promise<void>;
  updateDisplayName: (playerName: string) => Promise<void>;
}

export function useSyncedGame(): UseSyncedGameResult {
  const [game, setGame] = useState<SerializedGame | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const roomId = localStorage.getItem(STORAGE_ROOM_ID);
        const pid = localStorage.getItem(STORAGE_PLAYER_ID);
        if (!roomId || !pid) return;
        const g = await fetchGame(roomId);
        if (cancelled) return;
        if (pid === g.player1Id) {
          setPlayerId(pid);
          setGame(g);
        } else if (g.type === "pvp" && g.player2Id === pid) {
          setPlayerId(pid);
          setGame(g);
        } else {
          localStorage.removeItem(STORAGE_PLAYER_ID);
          localStorage.removeItem(STORAGE_ROOM_ID);
        }
      } catch {
        localStorage.removeItem(STORAGE_PLAYER_ID);
        localStorage.removeItem(STORAGE_ROOM_ID);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const gameState = useMemo(
    () => (game ? mapBackendToGameState(game) : null),
    [game]
  );

  useEffect(() => {
    const id = game?.id;
    if (!id || !playerId) return;

    return subscribeToRoom(id, playerId, setGame);
  }, [game?.id, playerId]);

  const clearError = useCallback(() => setError(""), []);

  const createGame = useCallback(async (mode: GameMode, playerName: string) => {
    setLoading(true);
    setError("");
    try {
      const { playerId: pid, game: next } = await createRoom(playerName, mode);
      setPlayerId(pid);
      setGame(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create game");
    } finally {
      setLoading(false);
    }
  }, []);

  const joinGame = useCallback(async (roomId: string, playerName: string) => {
    setLoading(true);
    setError("");
    try {
      const { playerId: pid, game: next } = await joinRoom(roomId, playerName);
      setPlayerId(pid);
      setGame(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join game");
    } finally {
      setLoading(false);
    }
  }, []);

  const submitChoice = useCallback(
    async (choice: Choice) => {
      if (!game) return;
      try {
        const next = await playMoveApi(game.id, playerId, choice);
        setGame(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to submit choice");
      }
    },
    [game, playerId]
  );

  const startNewGame = useCallback(async () => {
    if (!game) return;
    try {
      const next = await resetGameApi(game.id);
      setGame(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start new game");
    }
  }, [game]);

  const updateDisplayName = useCallback(
    async (name: string) => {
      if (!game) return;
      try {
        const next = await patchDisplayNameApi(game.id, playerId, name);
        setGame(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update name");
      }
    },
    [game, playerId]
  );

  return {
    gameState,
    playerId,
    ready,
    loading,
    error,
    clearError,
    createGame,
    joinGame,
    submitChoice,
    startNewGame,
    updateDisplayName,
  };
}
