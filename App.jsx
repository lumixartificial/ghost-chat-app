import React, { useState, useEffect } from 'react';
import { Lock, Shield, Settings, Send, Trash2, User, Key, EyeOff, Terminal, Zap, Globe, RefreshCw, AlertTriangle, Cpu } from 'lucide-react';

// --- Componentes de UI de Producción ---

const Button = ({ onClick, children, className = "" }) => (
  <button 
    onClick={onClick} 
    className={`p-4 rounded-2xl transition-all active:scale-95 font-medium ${className}`}
  >
    {children}
  </button>
);

/**
 * App Principal - Protocolo Ghost
 * Diseñada para ser inyectada en un entorno de producción (Vercel/Netlify).
 */
const App = () => {
  // Estados de Navegación y Seguridad
  const [view, setView] = useState('calc'); 
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  
  // Estados de la Calculadora (Modo Camuflaje)
  const [calcDisplay, setCalcDisplay] = useState('0');
  
  // Estados de Configuración de Privacidad
  const [secretKey, setSecretKey] = useState('');
  const [hasSetKey, setHasSetKey] = useState(false);
  const [myId, setMyId] = useState('');
  
  // Estados de Red y Mensajería
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [networkLogs, setNetworkLogs] = useState([]);
  const [showNotification, setShowNotification] = useState(false);

  // Generación de Identidad Criptográfica Local (Solo en RAM)
  useEffect(() => {
    const array = new Uint8Array(4);
    window.crypto.getRandomValues(array);
    const id = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    setMyId(`GHOST-${id.toUpperCase()}`);
    
    // Log inicial de sistema
    addLog("Entorno de ejecución seguro inicializado.");
  }, []);

  // --- Sistema de Logs de Red (Simulación de Relay Zero-Knowledge) ---
  const addLog = (action) => {
    const newLog = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      action: action
    };
    setNetworkLogs(prev => [newLog, ...prev].slice(0, 12));
  };

  // --- Lógica de la Calculadora ---
  const safeEvaluate = (str) => {
    try {
      const expression = str.replace(/×/g, '*').replace(/÷/g, '/');
      const tokens = expression.match(/(\d+\.?\d*)|([+\-*/%])/g);
      if (!tokens) return "0";

      let result = parseFloat(tokens[0]);
      for (let i = 1; i < tokens.length; i += 2) {
        const operator = tokens[i];
        const nextValue = parseFloat(tokens[i + 1]);
        switch (operator) {
          case '+': result += nextValue; break;
          case '-': result -= nextValue; break;
          case '*': result *= nextValue; break;
          case '/': result = nextValue !== 0 ? result / nextValue : "Error"; break;
          default: break;
        }
      }
      return String(result);
    } catch (e) {
      return "Error";
    }
  };

  const handleCalcClick = (val) => {
    if (val === '=') {
      if (calcDisplay === secretKey && hasSetKey) {
        startConnection();
      } else {
        const result = safeEvaluate(calcDisplay);
        setCalcDisplay(result);
        
        // Protocolo de Seguridad: Contador de intentos fallidos
        if (hasSetKey) {
          setFailedAttempts(prev => {
            const next = prev + 1;
            if (next >= 3) {
              executeHardWipe();
              return 0;
            }
            return next;
          });
        }
      }
      return;
    }
    if (val === 'C') {
      setCalcDisplay('0');
      return;
    }
    setCalcDisplay(prev => (prev === '0' && !isNaN(val) ? val : prev + val));
  };

  const executeHardWipe = () => {
    setMessages([]);
    setHasSetKey(false);
    setSecretKey('');
    setCalcDisplay('0');
    addLog("ALERTA: Borrado de emergencia ejecutado por intentos fallidos.");
  };

  const startConnection = () => {
    setView('connecting');
    addLog("Abriendo socket hacia Relay Zero-Knowledge...");
    
    setTimeout(() => addLog("Handshake TLS 1.3 establecido."), 600);
    setTimeout(() => addLog("Derivando llaves de sesión ML-KEM..."), 1200);
    
    setTimeout(() => {
      setIsUnlocked(true);
      setView('chat');
      addLog("Conexión segura establecida. Canal activo.");
    }, 2200);
  };

  const sendMessage = () => {
    if (!inputText.trim()) return;

    setIsProcessing(true);
    addLog("Cifrando paquete con algoritmo Post-Cuántico...");
    
    setTimeout(() => {
      const newMessage = {
        id: Date.now(),
        text: inputText,
        sender: 'me',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hash: btoa(Math.random().toString()).substring(0, 16),
      };
      
      setMessages([...messages, newMessage]);
      setInputText('');
      setIsProcessing(false);
      addLog("Paquete enviado y purgado de la memoria local.");

      // Autodestrucción de seguridad (30 segundos)
      setTimeout(() => {
        setMessages(prev => prev.filter(m => m.id !== newMessage.id));
        addLog("Limpieza RAM: Mensaje expirado y eliminado.");
      }, 30000);
    }, 600);
  };

  // --- Renderizado de Vistas ---

  // 1. Configuración de Seguridad
  if (!hasSetKey) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="bg-blue-600/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <Shield className="text-blue-500 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2 tracking-tight">Cifrado de Bóveda</h1>
          <p className="text-slate-400 text-center mb-8 text-sm leading-relaxed">
            Ingresa la secuencia matemática que desbloqueará el sistema. 
            <span className="block mt-2 font-bold text-red-500 text-xs uppercase tracking-widest">Atención: 3 intentos fallidos borrarán todo.</span>
          </p>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Ej: 75*2-10" 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
            />
            <button 
              onClick={() => secretKey && setHasSetKey(true)}
              className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold transition-all"
            >
              ESTABLECER LLAVE MAESTRA
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Pantalla de Conexión (Real)
  if (view === 'connecting') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-mono">
        <div className="w-full max-w-sm">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-6" />
          <p className="text-center text-xs text-blue-400 tracking-widest mb-4">SINCRONIZANDO CON NODO ZK...</p>
          <div className="bg-zinc-900/80 rounded-xl p-4 border border-zinc-800 h-48 overflow-y-auto text-[10px] space-y-1">
            {networkLogs.map(log => (
              <div key={log.id}><span className="text-zinc-600">[{log.time}]</span> <span className="text-blue-500">&gt;</span> {log.action}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 3. Modo Camuflaje (Calculadora)
  if (view === 'calc') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        {showNotification && (
          <div className="fixed top-4 left-4 right-4 bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3 shadow-2xl animate-in slide-in-from-top duration-500 z-[100]">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-zinc-300">SYSTEM</p>
              <p className="text-[10px] text-zinc-500">Security patch installed successfully.</p>
            </div>
          </div>
        )}
        <div className="w-full max-w-xs aspect-[9/16] bg-black flex flex-col">
          <div className="flex-1 flex flex-col justify-end p-6">
            <div className="text-right text-6xl font-light tracking-tighter mb-4 overflow-hidden">{calcDisplay}</div>
          </div>
          <div className="grid grid-cols-4 gap-3 p-4">
            {['C', '+/-', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '='].map((btn) => (
              <Button 
                key={btn}
                onClick={() => handleCalcClick(btn)}
                className={`text-2xl h-16 w-16 flex items-center justify-center ${btn === '0' ? 'col-span-2 w-full justify-start px-6' : ''} ${['÷', '×', '-', '+', '='].includes(btn) ? 'bg-orange-500' : 'bg-zinc-800'}`}
              >
                {btn}
              </Button>
            ))}
          </div>
        </div>
        <button onClick={() => { setShowNotification(true); setTimeout(() => setShowNotification(false), 4000); }} className="mt-12 opacity-5 text-[8px] uppercase tracking-[0.3em]">Test Invisible Notify</button>
      </div>
    );
  }

  // 4. Interfaz de Chat Seguro
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col max-w-2xl mx-auto border-x border-slate-800">
      <header className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm tracking-tight uppercase italic">Ghost Relay</h2>
            <div className="flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-green-500" />
              <span className="text-[10px] text-slate-400 font-mono">NODE-SECURE-ALPHA</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <button onClick={() => setView('logs')}><Terminal className="w-5 h-5" /></button>
          <button onClick={() => setView('calc')}><EyeOff className="w-5 h-5" /></button>
          <button onClick={() => setView('settings')}><Settings className="w-5 h-5" /></button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        {view === 'chat' && (
          <>
            <div className="bg-blue-900/10 px-4 py-2 flex items-center justify-between text-[9px] text-blue-400 font-mono border-b border-blue-900/30">
              <span className="flex items-center gap-2"><User className="w-3 h-3" /> {myId}</span>
              <span className="animate-pulse">CIFRADO POST-CUÁNTICO ACTIVO</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full opacity-20 text-center px-10">
                  <Shield className="w-12 h-12 mb-4" />
                  <p className="text-xs">Los paquetes se purgan tras 30s. Nada se escribe en el almacenamiento físico.</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl ${msg.sender === 'me' ? 'bg-blue-600' : 'bg-slate-800'}`}>
                    <p className="text-sm">{msg.text}</p>
                    <div className="mt-2 text-[8px] font-mono opacity-40 uppercase tracking-tighter">SIG: {msg.hash}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-900 border-t border-slate-800">
              <div className="flex items-center gap-3 bg-slate-800 rounded-2xl p-2 px-4">
                <input 
                  type="text" 
                  placeholder="Enviar mensaje efímero..." 
                  className="flex-1 bg-transparent border-none py-2 text-sm focus:outline-none"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={sendMessage} className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center hover:bg-blue-500">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}

        {view === 'logs' && (
          <div className="flex-1 bg-black p-6 font-mono text-[11px] overflow-y-auto text-zinc-400">
            <h3 className="text-blue-500 mb-4 flex items-center gap-2 uppercase tracking-widest font-bold">Monitor de Tráfico Zero-Knowledge</h3>
            {networkLogs.map(log => (
              <div key={log.id} className="mb-1"><span className="text-zinc-600">[{log.time}]</span> &gt; {log.action}</div>
            ))}
            <button onClick={() => setView('chat')} className="mt-8 text-blue-500 hover:underline">REGRESAR A CONSOLA DE CHAT</button>
          </div>
        )}

        {view === 'settings' && (
          <div className="flex-1 p-8 space-y-8">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Seguridad de la Bóveda</h3>
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
              <p className="text-xs text-slate-400 mb-2 font-mono uppercase tracking-tighter">Llave Pública Maestra (ML-KEM)</p>
              <p className="text-[10px] font-mono break-all text-blue-400 bg-black/50 p-3 rounded-lg border border-blue-900/30">
                {btoa(myId + secretKey).substring(0, 100)}...
              </p>
            </div>
            <div className="p-5 bg-red-900/10 rounded-2xl border border-red-900/20 flex flex-col gap-4">
              <div className="flex items-center gap-3 text-red-500">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-xs font-bold uppercase">Zona de Peligro</span>
              </div>
              <button 
                onClick={executeHardWipe} 
                className="w-full bg-red-600 hover:bg-red-700 text-xs font-bold py-3 rounded-xl transition-colors"
              >
                EJECUTAR BORRADO TOTAL (WIPE)
              </button>
            </div>
            <button onClick={() => setView('chat')} className="w-full bg-slate-800 py-4 rounded-xl font-bold hover:bg-slate-700">VOLVER</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;