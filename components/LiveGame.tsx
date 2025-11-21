import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../types';
import { connectToLiveSession } from '../services/geminiService';
import { createPcmBlob, decodeAudioData, base64ToBytes } from '../utils/audioUtils';
import AudioVisualizer from './AudioVisualizer';
import { Mic, MicOff, XCircle } from 'lucide-react';
import { LiveServerMessage } from '@google/genai';

interface Props {
  gameState: GameState;
  onEndGame: () => void;
}

const LiveGame: React.FC<Props> = ({ gameState, onEndGame }) => {
  const [connected, setConnected] = useState(false);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);

  // Audio Contexts
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  
  // Stream references
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Live Session reference
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        // 1. Setup Audio Contexts
        inputCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

        // 2. Get Mic Stream
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

        // 3. Connect to Gemini Live
        const sessionPromise = connectToLiveSession(
          gameState.personality,
          gameState.topic,
          gameState.questions,
          {
            onOpen: () => {
              if (!isMounted) return;
              setConnected(true);
              console.log("Live Session Connected");

              // Setup Audio Input Processing
              if (inputCtxRef.current && streamRef.current) {
                sourceRef.current = inputCtxRef.current.createMediaStreamSource(streamRef.current);
                processorRef.current = inputCtxRef.current.createScriptProcessor(4096, 1, 1);
                
                processorRef.current.onaudioprocess = (e) => {
                  if (!isMicOn) return; // Mute logic
                  
                  const inputData = e.inputBuffer.getChannelData(0);
                  const pcmBlob = createPcmBlob(inputData);
                  
                  sessionPromise.then(session => {
                     session.sendRealtimeInput({ media: pcmBlob });
                  });
                };

                sourceRef.current.connect(processorRef.current);
                processorRef.current.connect(inputCtxRef.current.destination);
              }
            },
            onMessage: async (msg: LiveServerMessage) => {
               if (!isMounted) return;

               // Handle Audio Output
               const data = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
               if (data && outputCtxRef.current) {
                  setIsBotSpeaking(true);
                  const ctx = outputCtxRef.current;
                  
                  // Sync playback
                  nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                  
                  const audioBuffer = await decodeAudioData(base64ToBytes(data), ctx);
                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(ctx.destination);
                  
                  source.addEventListener('ended', () => {
                     audioSourcesRef.current.delete(source);
                     if (audioSourcesRef.current.size === 0) setIsBotSpeaking(false);
                  });
                  
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  audioSourcesRef.current.add(source);
               }

               // Handle Turn Complete (optional logic triggers)
               if (msg.serverContent?.turnComplete) {
                 // Could update UI state here
               }

               // Handle Interruption
               if (msg.serverContent?.interrupted) {
                 audioSourcesRef.current.forEach(s => s.stop());
                 audioSourcesRef.current.clear();
                 nextStartTimeRef.current = 0;
                 setIsBotSpeaking(false);
               }
            },
            onClose: () => {
              console.log("Session Closed");
              if(isMounted) onEndGame();
            },
            onError: (e) => {
              console.error("Session Error", e);
              if(isMounted) setError("Connection interrupted.");
            }
          }
        );
        sessionRef.current = sessionPromise;

      } catch (err) {
        console.error("Init failed", err);
        if(isMounted) setError("Failed to access microphone or connect.");
      }
    };

    init();

    return () => {
      isMounted = false;
      // Cleanup
      streamRef.current?.getTracks().forEach(t => t.stop());
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      inputCtxRef.current?.close();
      outputCtxRef.current?.close();
      // Can't explicitly close session object easily in this SDK version without the session instance, 
      // but closing the socket via callback context usually happens on page unload.
      // Assuming session.close() if we had the resolved session stored.
      sessionRef.current?.then((s: any) => s.close && s.close());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once

  const toggleMic = () => {
    setIsMicOn(!isMicOn);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-6 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">Live Voice Session</h2>
        <p className="text-slate-400 text-sm">Speak clearly to the host</p>
      </div>

      <div className="relative flex items-center justify-center">
         {/* Avatar / Visualizer Container */}
         <div className="w-64 h-64 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center relative shadow-[0_0_50px_-12px_rgba(167,139,250,0.25)]">
            {connected ? (
               <div className="absolute inset-0 flex items-center justify-center flex-col gap-4">
                  <div className="text-4xl">
                    {gameState.personality === 'Sarcastic Robot' && '🤖'}
                    {gameState.personality === 'Enthusiastic Game Show Host' && '🎤'}
                    {gameState.personality === 'Strict History Professor' && '👨‍🏫'}
                    {gameState.personality === 'Chill Surfer Dude' && '🏄'}
                  </div>
                  <AudioVisualizer isActive={connected} isSpeaking={isBotSpeaking} />
               </div>
            ) : (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            )}
         </div>
         
         {isBotSpeaking && (
            <div className="absolute -top-8 px-4 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full animate-pulse border border-emerald-500/50">
              HOST SPEAKING
            </div>
         )}
      </div>

      {error && (
        <div className="p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 text-sm max-w-md">
          {error}
        </div>
      )}

      <div className="flex items-center gap-6">
        <button 
          onClick={toggleMic}
          className={`p-4 rounded-full transition-all ${isMicOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
        >
          {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </button>
        
        <button 
          onClick={onEndGame}
          className="px-8 py-3 bg-slate-800 hover:bg-red-900/30 hover:text-red-400 border border-slate-700 rounded-xl font-semibold text-slate-300 transition-all flex items-center gap-2"
        >
          <XCircle className="w-5 h-5" />
          End Session
        </button>
      </div>

      <div className="text-center max-w-md text-xs text-slate-500 mt-8">
        Powered by Gemini 2.5 Flash Native Audio Preview. <br/>
        Latency may vary. Headphones recommended.
      </div>
    </div>
  );
};

export default LiveGame;