import { useState, useEffect, useRef } from 'react';
import {
  Check,
  Copy,
  Cpu,
  Crown,
  History,
  Minus,
  Pencil,
  Settings as SettingsIcon,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import type {
  Choice,
  GameMode,
  GameState,
  PlayerPresence,
  Round,
} from '../services/api';
import { soundManager } from '../utils/sounds';
import { SettingsPanel } from './SettingsPanel';

function presenceLabel(p: PlayerPresence): string {
  switch (p) {
    case 'online':
      return 'Online';
    case 'offline':
      return 'Offline';
    case 'waiting':
      return 'Open slot';
    case 'ai':
      return 'Computer';
  }
}

function presenceBadgeClass(p: PlayerPresence): string {
  switch (p) {
    case 'online':
      return 'bg-emerald-400/30 text-emerald-50 border border-emerald-300/40';
    case 'offline':
      return 'bg-white/15 text-white/80 border border-white/20';
    case 'waiting':
      return 'bg-amber-400/30 text-amber-50 border border-amber-300/40';
    case 'ai':
      return 'bg-violet-400/30 text-violet-50 border border-violet-300/40';
  }
}

interface GameBoardProps {
  gameState: GameState | null;
  currentPlayerId: string;
  onCreateGame: (mode: GameMode, playerName: string) => void;
  onJoinGame: (roomId: string, playerName: string) => void;
  onChoice: (choice: Choice) => void;
  onNewGame: () => void;
  onUpdatePlayerName: (newName: string) => void | Promise<void>;
}

export function GameBoard({
  gameState,
  currentPlayerId,
  onCreateGame,
  onJoinGame,
  onChoice,
  onNewGame,
  onUpdatePlayerName,
}: GameBoardProps) {
  const [selectedChoice, setSelectedChoice] = useState<Choice>(null);
  const [copied, setCopied] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinPlayerName, setJoinPlayerName] = useState('Player 2');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const prevRoundRef = useRef<number>(0);

  const isPlayer1 = gameState ? gameState.player1.id === currentPlayerId : false;
  const currentPlayer = gameState ? (isPlayer1 ? gameState.player1 : gameState.player2) : null;
  const opponent = gameState ? (isPlayer1 ? gameState.player2 : gameState.player1) : null;
  const canEditOwnName = Boolean(currentPlayer && !currentPlayer.isComputer);

  const myPresence: PlayerPresence = gameState
    ? isPlayer1
      ? gameState.player1Presence
      : gameState.player2Presence
    : 'offline';
  const theirPresence: PlayerPresence = gameState
    ? isPlayer1
      ? gameState.player2Presence
      : gameState.player1Presence
    : 'offline';

  const currentRound = gameState?.rounds.find(r => r.roundNumber === gameState.currentRound);
  const hasPlayerMadeChoice = currentRound
    ? isPlayer1
      ? currentRound.player1Choice !== null
      : currentRound.player2Choice !== null
    : false;

  const bothPlayersChosen = currentRound?.player1Choice && currentRound?.player2Choice;

  // Reset choice selection when moving to new round
  useEffect(() => {
    if (gameState && gameState.currentRound !== prevRoundRef.current) {
      setSelectedChoice(null);
      prevRoundRef.current = gameState.currentRound;
    }
  }, [gameState?.currentRound]);

  // Handle round result display
  useEffect(() => {
    if (bothPlayersChosen && currentRound?.winner !== null) {
      soundManager.playReveal();
      setShowResult(true);

      const timer = setTimeout(() => {
        // Play result sound
        if (currentRound.winner === 'tie') {
          soundManager.playTie();
        } else {
          const didWin =
            (isPlayer1 && currentRound.winner === 'player1') ||
            (!isPlayer1 && currentRound.winner === 'player2');
          if (didWin) {
            soundManager.playWin();
          } else {
            soundManager.playLose();
          }
        }

        const hideTimer = setTimeout(() => {
          setShowResult(false);
        }, 2000);

        return () => clearTimeout(hideTimer);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [bothPlayersChosen, currentRound?.winner, isPlayer1]);

  const handleChoice = (choice: Choice) => {
    if (hasPlayerMadeChoice || !gameState || gameState.status !== 'playing') return;
    soundManager.playSelect();
    setSelectedChoice(choice);
    onChoice(choice);
  };

  const copyRoomId = () => {
    if (!gameState) return;
    navigator.clipboard.writeText(gameState.roomId);
    soundManager.playClick();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartEdit = () => {
    if (!currentPlayer) return;
    setEditedName(currentPlayer.name);
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    const t = editedName.trim();
    if (t) {
      await Promise.resolve(onUpdatePlayerName(t));
      soundManager.playClick();
    }
    setIsEditingName(false);
  };

  const handleJoinGame = () => {
    if (!joinRoomId.trim() || !joinPlayerName.trim()) {
      alert('Please enter both room ID and your name');
      return;
    }
    onJoinGame(joinRoomId.trim(), joinPlayerName.trim());
    setShowJoinModal(false);
    setJoinRoomId('');
  };

  const getChoiceEmoji = (choice: Choice) => {
    switch (choice) {
      case 'rock':
        return '✊';
      case 'paper':
        return '✋';
      case 'scissors':
        return '✌️';
      default:
        return '❓';
    }
  };

  const roundWinnerBadge = (round: Round) => {
    if (!gameState) return null;
    if (round.winner === 'tie') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900">
          <Minus className="w-3.5 h-3.5 shrink-0" aria-hidden />
          Tie
        </span>
      );
    }
    const isP1 = round.winner === 'player1';
    const label = isP1
      ? gameState.player1.name.trim() || 'Player 1'
      : (gameState.player2?.name ?? '').trim() || 'Player 2';
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
          isP1 ? 'bg-blue-100 text-blue-900' : 'bg-purple-100 text-purple-900'
        }`}
      >
        <Crown className="w-3.5 h-3.5 shrink-0" aria-hidden />
        {label} wins
      </span>
    );
  };

  const getRoundResult = () => {
    if (!currentRound?.winner) return null;

    const didWin =
      (isPlayer1 && currentRound.winner === 'player1') ||
      (!isPlayer1 && currentRound.winner === 'player2');

    if (currentRound.winner === 'tie') {
      return {
        text: "It's a Tie!",
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
      };
    }

    return didWin
      ? {
          text: 'You Win This Round!',
          color: 'text-green-600',
          bgColor: 'bg-green-100',
        }
      : {
          text: 'You Lose This Round!',
          color: 'text-red-600',
          bgColor: 'bg-red-100',
        };
  };

  const getGameResult = () => {
    if (!gameState || gameState.status !== 'finished') return null;

    const lastGame = gameState.gamesHistory[gameState.gamesHistory.length - 1];
    if (!lastGame) return null;

    const didWin =
      (isPlayer1 && lastGame.winner === 'player1') ||
      (!isPlayer1 && lastGame.winner === 'player2');

    if (lastGame.winner === 'tie') {
      return {
        text: 'Game Tied!',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
      };
    }

    return didWin
      ? {
          text: '🎉 You Win the Game! 🎉',
          color: 'text-green-600',
          bgColor: 'bg-green-100',
        }
      : {
          text: 'You Lose the Game',
          color: 'text-red-600',
          bgColor: 'bg-red-100',
        };
  };

  // No active game - show game mode selection
  if (!gameState) {
    return (
      <>
        <div
          className="min-h-screen relative overflow-hidden"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1665186096425-45134ba4ddda?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/90 via-blue-900/90 to-indigo-900/90" />

          {/* Settings Button */}
          <button
            onClick={() => {
              soundManager.playClick();
              setSettingsOpen(true);
            }}
            className="absolute top-6 right-6 p-3 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors z-10"
          >
            <SettingsIcon className="w-6 h-6 text-white" />
          </button>

          <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6">
            <div className="text-center mb-12">
              <h1 className="text-6xl mb-4 text-white drop-shadow-lg">Rock Paper Scissors</h1>
              <p className="text-xl text-white/90">Choose your game mode to start playing</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
              <button
                onClick={() => {
                  soundManager.playSelect();
                  onCreateGame('pvc', 'Player 1');
                }}
                className="group relative overflow-hidden bg-white rounded-2xl shadow-2xl hover:shadow-3xl transition-all hover:scale-105 p-8"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 opacity-0 group-hover:opacity-10 transition-opacity" />
                <Cpu className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h3 className="mb-2 text-gray-900">Play vs Computer</h3>
                <p className="text-sm text-gray-600">Challenge the AI</p>
              </button>

              <button
                onClick={() => {
                  soundManager.playSelect();
                  onCreateGame('pvp', 'Player 1');
                }}
                className="group relative overflow-hidden bg-white rounded-2xl shadow-2xl hover:shadow-3xl transition-all hover:scale-105 p-8"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-600 opacity-0 group-hover:opacity-10 transition-opacity" />
                <Users className="w-16 h-16 text-purple-600 mx-auto mb-4" />
                <h3 className="mb-2 text-gray-900">Create Room</h3>
                <p className="text-sm text-gray-600">Play with a friend</p>
              </button>

              <button
                onClick={() => {
                  soundManager.playClick();
                  setShowJoinModal(true);
                }}
                className="group relative overflow-hidden bg-white rounded-2xl shadow-2xl hover:shadow-3xl transition-all hover:scale-105 p-8"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-green-600 opacity-0 group-hover:opacity-10 transition-opacity" />
                <Users className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="mb-2 text-gray-900">Join Room</h3>
                <p className="text-sm text-gray-600">Join existing game</p>
              </button>
            </div>
          </div>
        </div>

        {/* Join Room Modal */}
        {showJoinModal && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowJoinModal(false)}
            />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-50 p-8">
              <h2 className="mb-6">Join Game Room</h2>
              <div className="space-y-4">
                <div>
                  <label className="block mb-2">Your Name</label>
                  <input
                    type="text"
                    value={joinPlayerName}
                    onChange={(e) => setJoinPlayerName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-primary"
                    maxLength={20}
                  />
                </div>
                <div>
                  <label className="block mb-2">Room ID</label>
                  <input
                    type="text"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                    placeholder="Enter room ID"
                    className="w-full px-4 py-3 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                    maxLength={10}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowJoinModal(false)}
                    className="flex-1 px-4 py-3 border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleJoinGame}
                    className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Join Game
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </>
    );
  }

  // Active game UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 p-6">
      {/* Settings Button */}
      <button
        onClick={() => {
          soundManager.playClick();
          setSettingsOpen(true);
        }}
        className="fixed top-6 right-6 p-3 bg-white rounded-lg shadow-md hover:shadow-lg transition-all z-10"
      >
        <SettingsIcon className="w-6 h-6 text-gray-700" />
      </button>

      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header with Room Info */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="mb-1">
                {gameState.gameMode === 'pvc' ? 'Playing vs Computer' : `Room: ${gameState.roomId}`}
              </h2>
              {gameState.gameMode === 'pvp' && gameState.status === 'waiting' && (
                <p className="text-sm text-muted-foreground">Waiting for opponent to join...</p>
              )}
            </div>
            {gameState.gameMode === 'pvp' && (
              <button
                onClick={copyRoomId}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-md"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Share Room ID'}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Main column: scoreboard + play (first on mobile) */}
          <div className="order-1 min-w-0 flex-1 space-y-6 lg:order-2">
        {/* Score Board */}
        <div className="grid grid-cols-3 gap-6">
          {/* Player 1 */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center justify-between min-h-[28px]">
                {isEditingName && canEditOwnName ? (
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyPress={(e) => e.key === 'Enter' && handleSaveName()}
                    className="text-sm bg-white/20 px-2 py-1 rounded outline-none text-white placeholder-white/70"
                    placeholder="Your name"
                    autoFocus
                    maxLength={20}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm opacity-90">{currentPlayer?.name}</span>
                    {canEditOwnName && (
                      <button
                        onClick={handleStartEdit}
                        className="p-1 hover:bg-white/20 rounded transition-colors"
                        aria-label="Edit your name"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full w-fit ${presenceBadgeClass(myPresence)}`}
              >
                {presenceLabel(myPresence)}
              </span>
            </div>
            <div className="text-5xl text-center">
              {isPlayer1 ? gameState.player1RoundsWon : gameState.player2RoundsWon}
            </div>
          </div>

          {/* Round Counter */}
          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center justify-center">
            <div className="text-6xl mb-2">⚔️</div>
            <p className="text-sm text-muted-foreground mb-1">Round</p>
            <p className="text-3xl">{gameState.currentRound} / 5</p>
          </div>

          {/* Player 2 / Opponent */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex flex-col gap-2 mb-4">
              <span className="text-sm opacity-90">
                {opponent ? opponent.name : "Waiting for opponent"}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full w-fit ${presenceBadgeClass(theirPresence)}`}
              >
                {presenceLabel(theirPresence)}
              </span>
            </div>
            <div className="text-5xl text-center">
              {isPlayer1 ? gameState.player2RoundsWon : gameState.player1RoundsWon}
            </div>
          </div>
        </div>

        {/* Waiting Status */}
        {gameState.status === 'waiting' && (
          <div className="bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-300 rounded-2xl p-6 text-center shadow-lg">
            <div className="text-4xl mb-3">⏳</div>
            <p className="text-yellow-900 text-lg">Waiting for opponent to join...</p>
            <p className="text-sm text-yellow-700 mt-2">Share room ID: <span className="font-mono bg-white/50 px-3 py-1 rounded">{gameState.roomId}</span></p>
          </div>
        )}

        {/* Round Result */}
        {showResult && bothPlayersChosen && getRoundResult() && (
          <div className={`${getRoundResult()!.bgColor} rounded-2xl p-8 text-center shadow-lg animate-in fade-in zoom-in duration-300`}>
            <h2 className={`${getRoundResult()!.color} mb-6 text-3xl`}>{getRoundResult()!.text}</h2>
            <div className="flex justify-center items-center gap-12">
              <div className="text-center">
                <div className="text-8xl mb-3">{getChoiceEmoji(isPlayer1 ? currentRound?.player1Choice : currentRound?.player2Choice)}</div>
                <p className="text-sm text-muted-foreground">You</p>
              </div>
              <div className="text-4xl text-muted-foreground">VS</div>
              <div className="text-center">
                <div className="text-8xl mb-3">{getChoiceEmoji(isPlayer1 ? currentRound?.player2Choice : currentRound?.player1Choice)}</div>
                <p className="text-sm text-muted-foreground">{opponent?.name}</p>
              </div>
            </div>
          </div>
        )}

        {/* Game Finished */}
        {gameState.status === 'finished' && getGameResult() && (
          <div className={`${getGameResult()!.bgColor} rounded-2xl p-10 text-center shadow-lg`}>
            <Trophy className={`w-20 h-20 ${getGameResult()!.color} mx-auto mb-6`} />
            <h1 className={`${getGameResult()!.color} mb-4`}>{getGameResult()!.text}</h1>
            <p className="text-muted-foreground text-xl mb-8">
              Final Score: {isPlayer1 ? gameState.player1RoundsWon : gameState.player2RoundsWon} - {isPlayer1 ? gameState.player2RoundsWon : gameState.player1RoundsWon}
            </p>
            <button
              onClick={() => {
                soundManager.playClick();
                onNewGame();
              }}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg text-lg"
            >
              Play Again
            </button>
          </div>
        )}

        {/* Choice Selection */}
        {gameState.status === 'playing' && (
          <div className="bg-white rounded-2xl shadow-lg p-10">
            <h2 className="text-center mb-8">
              {hasPlayerMadeChoice ? '⏳ Waiting for opponent...' : '🎯 Make Your Choice'}
            </h2>

            <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto">
              {(['rock', 'paper', 'scissors'] as Choice[]).map((choice) => (
                <button
                  key={choice}
                  onClick={() => handleChoice(choice)}
                  disabled={hasPlayerMadeChoice}
                  className={`
                    group relative aspect-square rounded-2xl p-6 transition-all duration-200
                    ${hasPlayerMadeChoice
                      ? 'opacity-40 cursor-not-allowed bg-muted'
                      : 'hover:scale-110 hover:shadow-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white cursor-pointer'
                    }
                    ${selectedChoice === choice && !hasPlayerMadeChoice ? 'ring-4 ring-yellow-400 scale-110' : ''}
                  `}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="text-7xl mb-4 group-hover:scale-110 transition-transform">{getChoiceEmoji(choice)}</div>
                    <p className="capitalize text-xl">{choice}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
          </div>

        {/* Left sidebar (desktop): game history — below main column on mobile */}
        {(gameState.rounds.length > 0 || gameState.gamesHistory.length > 0) && (
          <aside className="order-2 w-full shrink-0 space-y-8 rounded-2xl border border-border/60 bg-white p-4 shadow-lg lg:order-1 lg:sticky lg:top-6 lg:w-[min(100%,20rem)] lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto xl:w-[22rem]">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <History className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              Game history
            </h3>

            {gameState.rounds.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                  Rounds — this match
                </h4>
                <ul className="space-y-3" aria-label="Round by round results">
                  {gameState.rounds.map((round) => (
                    <li
                      key={round.roundNumber}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-gradient-to-r from-slate-50/80 to-slate-100/50 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-semibold text-primary">
                          R{round.roundNumber}
                        </span>
                        <div className="min-w-0 shrink">{roundWinnerBadge(round)}</div>
                      </div>
                      <div className="flex flex-col items-stretch gap-2">
                        <div
                          className="flex items-center justify-between gap-2 rounded-lg bg-blue-50/80 px-2 py-1.5"
                          title={gameState.player1.name || 'Player 1'}
                        >
                          <span className="min-w-0 truncate text-xs font-medium text-blue-900/80">
                            {gameState.player1.name || 'Player 1'}
                          </span>
                          <span className="text-2xl leading-none" aria-hidden>
                            {getChoiceEmoji(round.player1Choice)}
                          </span>
                        </div>
                        <div className="text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          vs
                        </div>
                        <div
                          className="flex items-center justify-between gap-2 rounded-lg bg-purple-50/80 px-2 py-1.5"
                          title={gameState.player2?.name ?? 'Player 2'}
                        >
                          <span className="text-2xl leading-none" aria-hidden>
                            {getChoiceEmoji(round.player2Choice)}
                          </span>
                          <span className="min-w-0 truncate text-xs font-medium text-purple-900/80">
                            {gameState.player2?.name ?? 'Player 2'}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {gameState.gamesHistory.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                  Match results
                </h4>
                <div className="flex flex-col gap-3">
                  {gameState.gamesHistory.map((g) => {
                    const didWin =
                      (isPlayer1 && g.winner === 'player1') ||
                      (!isPlayer1 && g.winner === 'player2');
                    const wasTie = g.winner === 'tie';
                    const matchWinnerLabel =
                      g.winner === 'tie'
                        ? 'Match tied'
                        : g.winner === 'player1'
                          ? `${gameState.player1.name || 'Player 1'} won`
                          : `${gameState.player2?.name ?? 'Player 2'} won`;

                    return (
                      <div
                        key={g.gameNumber}
                        className={`flex flex-col gap-2 rounded-xl border p-3 ${
                          wasTie
                            ? 'border-amber-200 bg-amber-50/80'
                            : didWin
                              ? 'border-emerald-200 bg-emerald-50/80'
                              : 'border-red-200 bg-red-50/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium">Match {g.gameNumber}</span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              wasTie
                                ? 'bg-amber-200 text-amber-900'
                                : didWin
                                  ? 'bg-emerald-200 text-emerald-900'
                                  : 'bg-red-200 text-red-900'
                            }`}
                          >
                            {wasTie ? 'Tie' : didWin ? 'You won' : 'You lost'}
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-3 py-1">
                          <div className="flex flex-col items-center gap-0.5">
                            <User className="h-5 w-5 text-blue-600" aria-hidden />
                            <span className="max-w-[4rem] truncate text-[10px] text-muted-foreground">
                              {gameState.player1.name || 'P1'}
                            </span>
                            <span className="text-base font-semibold tabular-nums">
                              {g.player1RoundsWon}
                            </span>
                          </div>
                          <span className="text-muted-foreground">—</span>
                          <div className="flex flex-col items-center gap-0.5">
                            <User className="h-5 w-5 text-purple-600" aria-hidden />
                            <span className="max-w-[4rem] truncate text-[10px] text-muted-foreground">
                              {gameState.player2?.name ?? 'P2'}
                            </span>
                            <span className="text-base font-semibold tabular-nums">
                              {g.player2RoundsWon}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-2 border-t border-black/5 pt-2 text-xs text-muted-foreground">
                          {wasTie ? (
                            <>
                              <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              {matchWinnerLabel}
                            </>
                          ) : (
                            <>
                              <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                              <span className="font-medium text-foreground">{matchWinnerLabel}</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>
        )}
        </div>
      </div>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
