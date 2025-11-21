import React, { useState, useEffect, useRef } from 'react';
import { GameState, HostPersonality } from '../types';
import { playTextToSpeech } from '../services/geminiService';
import { Mic, Volume2 } from 'lucide-react';

interface Props {
  gameState: GameState;
  onRestart: () => void;
}

const StandardGame: React.FC<Props> = ({ gameState, onRestart }) => {
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  // Queue for sequencing TTS audio
  const audioQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    // Intro TTS
    speak(`Welcome to the game! I am your host, the ${gameState.personality}. Let's test your knowledge on ${gameState.topic}.`);
    
    return () => {
      audioCtxRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speak = (text: string) => {
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      // Append to queue
      audioQueueRef.current = audioQueueRef.current.then(async () => {
        if (ctx.state === 'closed') return;
        await playTextToSpeech(text, gameState.personality, ctx);
      });
    }
  };

  const handleNext = () => {
    if (currentQIdx < gameState.questions.length - 1) {
      setCurrentQIdx(prev => prev + 1);
      setShowAnswer(false);
    } else {
      speak(`Game over! You scored ${score} points.`);
      onRestart();
    }
  };

  const currentQ = gameState.questions[currentQIdx];

  const handleReveal = () => {
    setShowAnswer(true);
    speak(`The answer is ${currentQ.answer}. ${currentQ.context}`);
  };

  useEffect(() => {
    // Speak question when index changes
    // We use a small timeout for UI smoothness, but the queue prevents actual audio overlap.
    if (gameState.questions[currentQIdx] && !showAnswer) {
      const timer = setTimeout(() => {
        speak(`Question ${currentQIdx + 1}. ${gameState.questions[currentQIdx].question}`);
      }, 500);
      return () => clearTimeout(timer);
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQIdx]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl p-6 space-y-8 animate-fade-in">
      <div className="w-full flex justify-between items-center text-slate-400 text-sm uppercase tracking-wider font-bold">
        <span>Topic: {gameState.topic}</span>
        <span>{currentQIdx + 1} / {gameState.questions.length}</span>
      </div>

      <div className="bg-slate-800/80 p-8 rounded-2xl border border-slate-700 shadow-xl w-full min-h-[300px] flex flex-col justify-center items-center text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
        
        <Volume2 className="w-8 h-8 text-purple-400 mb-6 animate-pulse" />
        
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
          {currentQ.question}
        </h2>

        {showAnswer ? (
          <div className="animate-fade-in-up space-y-4">
             <p className="text-xl text-emerald-400 font-bold">{currentQ.answer}</p>
             <p className="text-slate-300 text-sm italic">{currentQ.context}</p>
          </div>
        ) : (
          <div className="text-slate-500 italic">Think about your answer...</div>
        )}
      </div>

      <div className="flex gap-4 w-full">
        {!showAnswer ? (
          <button 
            onClick={handleReveal}
            className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-900/20"
          >
            Reveal Answer
          </button>
        ) : (
           <>
             <button 
              onClick={() => { setScore(s => s + 1); handleNext(); }}
              className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all"
            >
              I Got It Right
            </button>
            <button 
              onClick={() => handleNext()}
              className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-all"
            >
              Missed It
            </button>
           </>
        )}
      </div>
      
      <div className="text-slate-500 text-xs">
        Using Gemini 2.5 Flash TTS • Standard Mode
      </div>
    </div>
  );
};

export default StandardGame;