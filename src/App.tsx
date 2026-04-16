import { useState, useEffect, useCallback, useRef } from 'react';
import Vapi from '@vapi-ai/web';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Terminal, Activity, BookOpen, Settings } from 'lucide-react';

// Using the exposed process.env variables from vite.config.ts
const VAPI_PUBLIC_KEY = process.env.VAPI_PUBLIC_KEY || '';
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID || '';

interface Interaction {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function App() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [vapi, setVapi] = useState<Vapi | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vapiInstance = new Vapi(VAPI_PUBLIC_KEY);
    setVapi(vapiInstance);

    vapiInstance.on('call-start', () => {
      setIsConnected(true);
      setIsConnecting(false);
      addInteraction('assistant', 'DevPulse online. How can I assist with your workflow?');
    });

    vapiInstance.on('call-end', () => {
      setIsConnected(false);
      setIsConnecting(false);
      addInteraction('assistant', 'Session terminated. Standing by.');
    });

    vapiInstance.on('message', (message) => {
      if (message.type === 'transcript' && message.transcriptType === 'final') {
        const role = (message as any).role === 'user' ? 'user' : 'assistant';
        const transcript = (message as any).transcript;
        addInteraction(role, transcript);
      }
    });

    vapiInstance.on('error', (e) => {
      console.error('Vapi Error:', e);
      setIsConnecting(false);
      setIsConnected(false);
    });

    return () => {
      vapiInstance.stop();
    };
  }, []);

  const addInteraction = useCallback((role: 'user' | 'assistant', content: string) => {
    setInteractions(prev => [
      ...prev,
      { id: Math.random().toString(36).substr(2, 9), role, content, timestamp: new Date() }
    ].slice(-10)); // Keep only last 10
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [interactions]);

  const toggleCall = async () => {
    if (!vapi) return;

    if (isConnected) {
      vapi.stop();
    } else {
      setIsConnecting(true);
      try {
        await vapi.start(VAPI_ASSISTANT_ID);
      } catch (err) {
        console.error('Failed to start call:', err);
        setIsConnecting(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8 select-none">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
        <div className="absolute top-0 left-0 w-full h-full" style={{ 
          backgroundImage: 'radial-gradient(circle at 2px 2px, #3b82f6 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      <header className="fixed top-8 left-8 flex items-center gap-3 z-10">
        <div className="w-10 h-10 specialist-card rounded-lg flex items-center justify-center">
          <Activity className={`w-5 h-5 ${isConnected ? 'text-blue-400' : 'text-gray-600'}`} />
        </div>
        <div>
          <h1 className="text-xs uppercase tracking-[0.2em] font-semibold text-gray-500">System Status</h1>
          <p className="text-sm font-mono">{isConnected ? 'OPERATIONAL' : 'STANDBY'}</p>
        </div>
      </header>

      {/* Main Pulse Interface */}
      <main className="relative flex flex-col items-center gap-12 max-w-2xl w-full">
        <div className="relative group">
          {/* Outer Ring */}
          <div className={`w-64 h-64 rounded-full border border-dashed border-gray-700 flex items-center justify-center transition-all duration-700 ${isConnected ? 'border-blue-500/50' : ''}`}>
            {/* Inner Ring */}
            <div className={`w-48 h-48 rounded-full border border-gray-800 flex items-center justify-center transition-all duration-500 ${isConnected ? 'border-blue-400/30' : ''}`}>
              {/* Primary Pulse Orb */}
              <button 
                onClick={toggleCall}
                disabled={isConnecting}
                className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 specialist-card active:scale-95 ${
                  isConnected 
                    ? 'is-active-pulse text-white' 
                    : isConnecting 
                      ? 'bg-yellow-500/20 text-yellow-400' 
                      : 'bg-gray-800/40 text-gray-400 hover:bg-gray-800'
                }`}
              >
                {isConnected ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isConnected && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-500 rounded-full text-[10px] font-bold tracking-widest uppercase"
              >
                Listening
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-4xl font-light tracking-tight">DevPulse</h2>
          <p className="text-gray-500 terminal-text max-w-md">Ambient Voice-Native Developer Experience Agent. Hands-free reasoning & context retrieval.</p>
        </div>

        {/* Console / Interaction History */}
        <div className="w-full specialist-card rounded-xl overflow-hidden flex flex-col h-64">
          <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <Terminal className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Context Console</span>
            </div>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-700" />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-700" />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-700" />
            </div>
          </div>
          <div 
            ref={scrollRef}
            className="flex-1 p-4 overflow-y-auto space-y-3 terminal-text bg-black/40"
          >
            {interactions.length === 0 ? (
              <p className="text-gray-600 opacity-50 italic">Waiting for input...</p>
            ) : (
              interactions.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  <span className={`uppercase font-bold text-[9px] mt-1 ${msg.role === 'assistant' ? 'text-blue-500' : 'text-green-500'}`}>
                    [{msg.role}]
                  </span>
                  <span className={msg.role === 'assistant' ? 'text-gray-200' : 'text-gray-400'}>
                    {msg.content}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Footer Tools */}
      <footer className="fixed bottom-8 flex gap-4">
        {[
          { icon: BookOpen, label: 'Docs' },
          { icon: Settings, label: 'Config' },
        ].map((tool, i) => (
          <button key={i} className="flex items-center gap-2 px-4 py-2 specialist-card rounded-full hover:bg-white/5 transition-colors">
            <tool.icon className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">{tool.label}</span>
          </button>
        ))}
      </footer>

      {/* Instructions Overlay if Keys Missing */}
      {!VAPI_PUBLIC_KEY && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-12 text-center backdrop-blur-xl">
          <div className="max-w-md space-y-6">
            <MicOff className="w-16 h-16 text-yellow-500 mx-auto" />
            <h3 className="text-xl font-medium">Configuration Required</h3>
            <p className="text-gray-500 leading-relaxed text-sm">
              Please provide your <code className="text-blue-400">VAPI_PUBLIC_KEY</code> and <code className="text-blue-400">VAPI_ASSISTANT_ID</code> in the Secrets/Environment panel to activate voice orchestration.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
