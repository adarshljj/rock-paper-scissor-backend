import { GameBoard } from "./components/GameBoard";
import { useSyncedGame } from "./hooks/useSyncedGame";
export default function App() {
  const {
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
  } = useSyncedGame();

  if (loading || !ready) {
    return (
      <div className="size-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <GameBoard
        gameState={gameState}
        currentPlayerId={playerId}
        onCreateGame={createGame}
        onJoinGame={joinGame}
        onChoice={submitChoice}
        onNewGame={startNewGame}
        onUpdatePlayerName={updateDisplayName}
      />
      {error && (
        <div className="fixed bottom-6 right-6 bg-red-500 text-white px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 z-50">
          <p className="font-medium">{error}</p>
          <button
            onClick={() => clearError()}
            className="absolute top-2 right-2 text-white/80 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
