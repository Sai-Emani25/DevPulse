import { useState, useEffect, useCallback, useRef } from 'react';
import Vapi from '@vapi-ai/web';
import { motion, AnimatePresence } from 'motion/react';

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
  const [isSimulated, setIsSimulated] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qdrantKey, setQdrantKey] = useState(localStorage.getItem('devpulse_qdrant_key') || '');
  const [qdrantUrl, setQdrantUrl] = useState(localStorage.getItem('devpulse_qdrant_url') || '');
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [vapi, setVapi] = useState<Vapi | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (VAPI_PUBLIC_KEY) {
      try {
        const vapiInstance = new Vapi(VAPI_PUBLIC_KEY);
        setVapi(vapiInstance);

        vapiInstance.on('call-start', () => {
          setIsConnected(true);
          setIsConnecting(false);
          setIsSimulated(false);
          setError(null);
          addInteraction('assistant', 'DevPulse online. Standing by for hands-free reasoning.');
        });

        vapiInstance.on('call-end', () => {
          setIsConnected(false);
          setIsConnecting(false);
          addInteraction('assistant', 'System offline.');
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
          const errorMsg = e.message || 'An unexpected voice hardware error occurred.';
          setError(`Device Error: ${errorMsg}`);
          setIsConnecting(false);
          setIsConnected(false);
          
          // Clear error after 5s
          setTimeout(() => setError(null), 5000);
        });

        return () => {
          vapiInstance.stop();
        };
      } catch (err) {
        console.error('Vapi Initialization Error:', err);
        setError('Failed to initialize voice SDK. Check your network or Public Key.');
      }
    }
  }, []);

  const addInteraction = useCallback((role: 'user' | 'assistant', content: string) => {
    setInteractions(prev => [
      ...prev,
      { id: Math.random().toString(36).substr(2, 9), role, content, timestamp: new Date() }
    ].slice(-5)); 
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [interactions]);

  const toggleCall = async () => {
    setError(null); // Clear previous errors
    
    // Persist keys
    localStorage.setItem('devpulse_qdrant_key', qdrantKey);
    localStorage.setItem('devpulse_qdrant_url', qdrantUrl);

    if (!vapi) {
      if (isSimulated) {
        setIsSimulated(false);
        addInteraction('assistant', 'Simulation ended.');
      } else {
        setIsSimulated(true);
        addInteraction('assistant', 'VOICE HARDWARE NOT DETECTED. INITIALIZING UI SIMULATION.');
        setTimeout(() => {
          addInteraction('user', 'Can you explain the current re-render issue?');
          setTimeout(() => {
            addInteraction('assistant', 'RAG search would normally occur here. Based on cached logs: You have an infinite loop in App.tsx due to an unmemoized callback.');
          }, 1500);
        }, 1000);
      }
      return;
    }

    if (isConnected) {
      vapi.stop();
    } else {
      setIsConnecting(true);
      try {
        await vapi.start(VAPI_ASSISTANT_ID, {
          metadata: {
            qdrantKey,
            qdrantUrl
          }
        });
      } catch (err: any) {
        console.error('Failed to start call:', err);
        setIsConnecting(false);
        
        const friendlyMsg = err.message?.includes('Assistant ID') 
          ? 'Invalid Assistant ID. Please verify your Vapi configuration.'
          : 'Could not establish connection to Vapi servers.';
          
        setError(friendlyMsg);
        setIsSimulated(true);
        addInteraction('assistant', 'CONNECTION FAILED. FALLING BACK TO UI SIMULATION.');
        
        setTimeout(() => setError(null), 5000);
      }
    }
  };

  const activeStatus = isConnected || isSimulated;

  return (
    <div className="h-screen w-screen grid grid-rows-[64px_1fr_180px] bg-[#0C0D0F] text-[#E2E4E9]">
      {/* Error Alert Overlay */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-red-900/90 border border-red-500 text-white px-6 py-3 rounded shadow-2xl backdrop-blur-md flex items-center gap-3"
          >
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 opacity-50 hover:opacity-100">&times;</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-[#24282E] flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 font-bold tracking-tighter text-xl">
            <div className={`w-2 h-2 ${activeStatus ? 'bg-[#00FFC2]' : 'bg-red-500'} rounded-full shadow-[0_0_10px_currentcolor]`} />
            DEVPULSE <span className="font-light opacity-50 ml-1">v1.0.4 {isSimulated && '(SIM)'}</span>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="ml-4 p-1 hover:bg-[#24282E] rounded transition-colors"
            title="System Configuration"
          >
            <svg className="w-4 h-4 opacity-50 hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </button>
        </div>
        <div className="flex gap-8 font-mono text-[11px] uppercase text-[#848995]">
          <span>MODEL: <span className="text-[#E2E4E9] ml-1.5">GEMINI-1.5-FLASH</span></span>
          <span className="hidden md:inline">LATENCY: <span className="text-[#E2E4E9] ml-1.5">{isConnected ? '142MS' : '---'}</span></span>
          <span>STATUS: <span className={`ml-1.5 ${activeStatus ? 'text-[#00FFC2]' : ''}`}>{isConnected ? 'LISTENING' : isSimulated ? 'SIMULATING' : 'STANDBY'}</span></span>
        </div>
      </header>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-6 z-50 w-80 bg-[#15171B] border border-[#24282E] p-4 shadow-2xl space-y-4"
          >
            <div>
              <label className="label !mb-1">Qdrant URL</label>
              <input 
                type="text" 
                value={qdrantUrl}
                onChange={(e) => setQdrantUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-[#0C0D0F] border border-[#24282E] px-2 py-1 text-xs font-mono focus:border-[#00FFC2] outline-none"
              />
            </div>
            <div>
              <label className="label !mb-1">Qdrant API Key</label>
              <input 
                type="password" 
                value={qdrantKey}
                onChange={(e) => setQdrantKey(e.target.value)}
                placeholder="Enter key..."
                className="w-full bg-[#0C0D0F] border border-[#24282E] px-2 py-1 text-xs font-mono focus:border-[#00FFC2] outline-none"
              />
            </div>
            <p className="text-[10px] text-[#848995]">Keys are sent as metadata to Vapi and processed server-side.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="grid grid-cols-1 md:grid-cols-[280px_1fr_280px] gap-[1px] bg-[#24282E]">
        {/* Left Panel: Context */}
        <section className="panel bg-[#0C0D0F] hidden md:block">
          <span className="label">Qdrant Context Retrieval</span>
          <div className="space-y-3">
            <div className="rag-item">
              <div className="rag-tag">DOCS:REACT</div>
              <p className="mt-2 text-sm">Memoization patterns for high-frequency state updates.</p>
            </div>
            <div className="rag-item opacity-60">
              <div className="rag-tag">CODE:UTILS.TS</div>
              <p className="mt-2 text-sm">Existing implementation of useDebounce hook in core lib.</p>
            </div>
          </div>
        </section>

        {/* Center: Voice Visualization */}
        <section className="voice-center">
          <button 
            onClick={toggleCall}
            disabled={isConnecting}
            className="flex items-center gap-1.5 h-32 mb-10 transition-transform active:scale-95"
          >
            {[0.3, 0.5, 0.7, 1, 0.7, 0.5, 0.3].map((op, i) => (
              <div 
                key={i} 
                className={`bar voice-bar`}
                style={{ 
                  height: i === 3 ? '110px' : i === 1 || i === 5 ? '80px' : i===2 || i===4 ? '60px' : '40px',
                  opacity: activeStatus ? op : 0.1,
                  animationDelay: `${i * 0.1}s`,
                  animationPlayState: activeStatus ? 'running' : 'paused'
                }} 
              />
            ))}
          </button>
          
          <div className="text-center max-w-md px-4 min-h-[80px]">
            <AnimatePresence mode="wait">
              {interactions.length > 0 ? (
                <motion.div
                  key={interactions[interactions.length - 1].id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <p className="text-2xl font-normal leading-tight">
                    {interactions[interactions.length - 1].role === 'assistant' ? (
                      interactions[interactions.length - 1].content
                    ) : (
                      <span className="text-[#848995]">"{interactions[interactions.length - 1].content}"</span>
                    )}
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <p className="text-2xl font-light text-[#848995]"> Standing by for developer input... </p>
                  {!VAPI_PUBLIC_KEY && (
                    <p className="text-[10px] text-red-500/50 uppercase tracking-widest">Simulation Mode: Credentials Missing</p>
                  )}
                </div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Right Panel: Tools */}
        <section className="panel bg-[#0C0D0F] hidden md:block">
          <span className="label">Active Tools</span>
          <div className="space-y-3">
            <div className={`rag-item transition-all ${activeStatus ? 'border-[#00FFC2] bg-[#00FFC2]/10' : ''}`}>
              <p className="font-bold">Search_Docs</p>
              <span className="text-[11px] opacity-80 font-mono">
                {activeStatus ? 'Query: "React re-render loop"' : 'Status: Idle'}
              </span>
            </div>
            <div className="rag-item">
              <p className="font-bold">Read_Terminal</p>
              <span className="text-[11px] opacity-80 font-mono">Status: Watching</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#0C0D0F] border-t border-[#24282E] grid grid-cols-1 md:grid-cols-3 gap-6 p-6 overflow-hidden">
        <div className="control-card">
          <div className="flex justify-between mb-1 items-center">
            <span className="label !m-0">Engine Processing</span>
            <span className="font-mono text-[11px]">{activeStatus ? '35ms' : '---'}</span>
          </div>
          <div className="latency-meter">
            <div className="latency-fill" style={{ width: activeStatus ? '35%' : '0%' }} />
          </div>
        </div>
        <div className="control-card hidden md:block">
          <div className="flex justify-between mb-1 items-center">
            <span className="label !m-0">Context Score</span>
            <span className="font-mono text-[11px]">{activeStatus ? '0.94' : '---'}</span>
          </div>
          <div className="latency-meter">
            <div className="latency-fill" style={{ width: activeStatus ? '94%' : '0%' }} />
          </div>
        </div>
        <div className="control-card hidden md:block">
          <div className="flex justify-between mb-1 items-center">
            <span className="label !m-0">TTS Synthesis</span>
            <span className="font-mono text-[11px]">{activeStatus ? '102ms' : '---'}</span>
          </div>
          <div className="latency-meter">
            <div className="latency-fill" style={{ width: activeStatus ? '62%' : '0%' }} />
          </div>
        </div>
      </footer>
    </div>
  );
}
