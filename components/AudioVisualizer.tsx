import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean; // Visual distinction for bot vs user
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, isSpeaking }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let t = 0;

    const render = () => {
      if (!isActive) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      
      t += 0.1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Base color
      ctx.strokeStyle = isSpeaking ? '#34d399' : '#a78bfa'; // Emerald for Bot, Violet for Idle/User
      ctx.lineWidth = 2;
      
      // Draw multiple waves
      for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        for (let i = 0; i < canvas.width; i++) {
          const scale = isSpeaking ? 30 : 5; // Amplitude
          const freq = isSpeaking ? 0.05 : 0.02;
          const y = centerY + Math.sin(i * freq + t + j) * scale * Math.sin(i/canvas.width * Math.PI); 
          // The second sin fades edges
          
          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
        }
        ctx.stroke();
      }
      
      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, isSpeaking]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={100} 
      className="w-full max-w-md h-24 rounded-lg bg-slate-800/50 backdrop-blur-sm"
    />
  );
};

export default AudioVisualizer;