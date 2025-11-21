import React, { useState } from 'react';
import { GameState, GameMode, HostPersonality, TriviaQuestion } from './types';
import { generateTriviaQuestions } from './services/geminiService';
import StandardGame from './components/StandardGame';
import LiveGame from './components/LiveGame';
import { Sparkles, Search, Radio, BrainCircuit, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    mode: GameMode.SETUP,
    topic: '',
    personality: HostPersonality.ENTHUSIASTIC_HOST,
    questions: [],
    score: 0,
    currentQuestionIndex: 0
  });

  const [loading, setLoading] = useState(false);
  const [inputTopic, setInputTopic] = useState('Space Exploration');
  const [sources, setSources] = useState<string[]>([]);

  const startGame = async (mode: GameMode) => {
    setLoading(true);
    setSources([]);
    try {
      // 1. Generate Content using Search Grounding
      const { questions, sources: groundSources } = await generateTriviaQuestions(inputTopic);
      setSources(groundSources);

      // 2. Update State
      setGameState(prev => ({
        ...prev,
        mode: mode, // LIVE or STANDARD
        topic: inputTopic,
        questions: questions,
        score: 0,
        currentQuestionIndex: 0
      }));
    } catch (e) {
      alert("Failed to generate game. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetGame = () => {
    setGameState(prev => ({ ...prev, mode: GameMode.SETUP }));
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col">
      {/* Header */}
      <header className="p-6 border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-blue-500 to-purple-500 p-2 rounded-lg">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              TriviaGenius AI
            </h1>
          </div>
          {gameState.mode !== GameMode.SETUP && (
            <button 
              onClick={resetGame}
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              EXIT GAME
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative">
        
        {/* Setup Screen */}
        {gameState.mode === GameMode.SETUP && !loading && (
          <div className="w-full max-w-xl space-y-8 animate-fade-in">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-extrabold tracking-tight text-white">
                Create Your Game
              </h2>
              <p className="text-slate-400">
                Powered by Gemini 2.5. Choose a topic and a host personality.
              </p>
            </div>

            <div className="space-y-6 bg-slate-800/50 p-8 rounded-2xl border border-slate-700">
              {/* Topic Input */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                   <Search className="w-4 h-4" /> Topic
                </label>
                <input
                  type="text"
                  value={inputTopic}
                  onChange={(e) => setInputTopic(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder-slate-600"
                  placeholder="e.g., Ancient Rome, 80s Pop Music, Quantum Physics"
                />
              </div>

              {/* Personality Selector */}
              <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                   <Sparkles className="w-4 h-4" /> Host Personality
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.values(HostPersonality).map((p) => (
                    <button
                      key={p}
                      onClick={() => setGameState(prev => ({ ...prev, personality: p }))}
                      className={`p-3 rounded-lg text-left text-sm font-medium transition-all border ${
                        gameState.personality === p 
                          ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/50' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col gap-3">
                <button
                  onClick={() => startGame(GameMode.PLAY_LIVE)}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02]"
                >
                  <Radio className="w-5 h-5" />
                  Start Voice Session (Live API)
                </button>
                <button
                  onClick={() => startGame(GameMode.PLAY_STANDARD)}
                  className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all"
                >
                  <Sparkles className="w-5 h-5" />
                  Standard Mode (Text & TTS)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading Screen */}
        {loading && (
           <div className="flex flex-col items-center gap-4 text-purple-400">
             <Loader2 className="w-12 h-12 animate-spin" />
             <div className="text-lg font-medium">Grounding with Google Search...</div>
             <div className="text-sm text-slate-500">Verifying facts and preparing questions</div>
           </div>
        )}

        {/* Game Screens */}
        {gameState.mode === GameMode.PLAY_STANDARD && (
          <StandardGame gameState={gameState} onRestart={resetGame} />
        )}

        {gameState.mode === GameMode.PLAY_LIVE && (
          <LiveGame gameState={gameState} onEndGame={resetGame} />
        )}

      </main>
      
      {/* Footer with Source Attribution (Required for Grounding) */}
      {sources.length > 0 && gameState.mode !== GameMode.SETUP && (
        <footer className="p-4 bg-slate-900/50 border-t border-slate-800 text-center">
           <div className="max-w-4xl mx-auto flex flex-col items-center gap-2">
             <span className="text-xs text-slate-500 uppercase font-bold">Source Data (Google Search Grounding)</span>
             <div className="flex flex-wrap justify-center gap-4 text-xs text-blue-400">
               {sources.slice(0, 3).map((s, i) => (
                 <a key={i} href={s} target="_blank" rel="noreferrer" className="hover:underline truncate max-w-[200px]">
                   {new URL(s).hostname}
                 </a>
               ))}
             </div>
           </div>
        </footer>
      )}
    </div>
  );
};

export default App;