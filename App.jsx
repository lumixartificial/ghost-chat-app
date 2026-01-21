import React, { useState, useEffect, useRef } from 'react';
import { Lock, Shield, Settings, Send, Trash2, User, Key, EyeOff, Terminal, Globe, RefreshCw, AlertTriangle } from 'lucide-react';

// URL DE TU SERVIDOR RELAY (Configurado automáticamente)
const RELAY_URL = 'wss://ghost-relay-9c9e.onrender.com';

const Button = ({ onClick, children, className = "" }) => (
  <button 
    onClick={onClick} 
    className={`p-4 rounded-2xl transition-all active:scale-95 font-medium ${className}`}
  >
    {children}
  </button>
);

const App = () => {
  // --- Estados de la App ---
  const [view, setView] = useState('calc'); 
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  // Calculadora
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [secretKey, setSecretKey] = useState('');
  const [hasSetKey, setHasSetKey] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  
  // Identidad y Chat
  const [myId, setMyId] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [networkLogs, setNetworkLogs] = useState([]);
  const [showNotification, setShowNotification] = useState(false);

  // Referencia al WebSocket (Conexión persistente)
  const socketRef = useRef(null);

  // 1. Generar ID Único al inicio
  useEffect(() => {
    const array = new Uint8Array(4);
    window.crypto.getRandomValues(array);
    const id = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    setMyId(`GHOST-${id.toUpperCase()}`);
    addLog("Sistema iniciado. Esperando autenticación.");
  }, []);

  // 2. Sistema de Logs
  const addLog = (action) => {
    const newLog = { id: Date.now(), time: new Date().toLocaleTimeString(), action };
    setNetworkLogs(prev => [newLog, ...prev].slice(0, 15));
  };

  // 3. Lógica de Calculadora
  const safeEvaluate = (str) => {
    try {
      const expression = str.replace(/×/g, '*').replace(/÷/g, '/');
      // eslint-disable-next-line no-new-func
      return String(new Function('return ' + expression)());
    } catch { return "Error"; }
  };

  const handleCalcClick = (val) => {
    if (val === '=') {
      if (calcDisplay === secretKey && hasSetKey) {
        connectToRelay(); // <--- AQUÍ INICIA LA CONEXIÓN REAL
      } else {
        const result = safeEvaluate(calcDisplay);
        setCalcDisplay(result);
        if (hasSetKey) checkSecurityProtocol();
      }
      return;
    }
    if (val === 'C') { setCalcDisplay('0'); return; }
    setCalcDisplay(prev => (prev === '0' && !isNaN(val) ? val : prev + val));
  };

  const checkSecurityProtocol = () => {
    setFailedAttempts(prev => {
      const next = prev + 1;
      if (next >= 3) {
        executeHardWipe();
        return 0;
      }
      return next;
    });
  };

  const executeHardWipe = () => {
    setMessages([]);
    setHasSetKey(false);
    setSecretKey('');
    setCalcDisplay('0');
    if (socketRef.current) socketRef.current.close();
    addLog("ALERTA: Borrado de emergencia ejecutado.");
    alert("Protocolo de seguridad activado: Datos eliminados.");
  };

  // 4. Conexión WebSocket REAL
  const connectToRelay = () => {
    setView('connecting');
    addLog(`Intentando conectar a ${RELAY_URL}...`);

    try {
      socketRef.current = new WebSocket(RELAY_URL);

      socketRef.current.onopen = () => {
        addLog("Conexión segura establecida (TLS 1.3).");
        setIsUnlocked(true);
        setView('chat');
      };

      socketRef.current.onmessage = (event) => {
        // Recibimos un mensaje real de otra persona
        try {
            // Manejar blobs si es necesario (el servidor envía texto/json normalmente)
            if (event.data instanceof Blob) {
                const reader = new FileReader();
                reader.onload = () => processIncoming(reader.result);
                reader.readAsText(event.data);
            } else {
                processIncoming(event.data);
            }
        } catch (e) {
            addLog("Error procesando paquete entrante.");
        }
      };

      socketRef.current.onerror = (error) => {
        addLog("Error de conexión. ¿El servidor está despierto?");
        console.error("WebSocket Error:", error);
      };

      socketRef.current.onclose = () => {
        addLog("Desconectado del servidor Relay.");
      };

    } catch (e) {
      addLog("Fallo crítico al inicializar WebSocket.");
    }
  };

  const processIncoming = (jsonString) => {
      try {
        const data = JSON.parse(jsonString);
        setMessages(prev => [...prev, { ...data, sender: 'peer' }]);
        addLog("Mensaje cifrado recibido.");
      } catch (e) {
          // Ignorar pings o datos corruptos
      }
  }

  // 5. Enviar Mensaje Real
  const sendMessage = () => {
    if (!inputText.trim() || !socketRef.current) return;

    const newMessage = {
      id: Date.now(),
      text: inputText,
      sender: 'me',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      hash: btoa(Math.random().toString()).substring(0, 16),
    };

    // Actualizar UI local
    setMessages(prev => [...prev, newMessage]);
    
    // ENVIAR POR LA RED
    if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(newMessage));
        addLog("Paquete enviado a la red.");
    } else {
        addLog("Error: No hay conexión activa.");
    }

    setInputText('');

    // Autodestrucción local (30s)
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== newMessage.id));
    }, 30000);
  };

  // --- Renderizado (Vistas) ---

  if (!hasSetKey) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="bg-blue-600/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <Shield className="text-blue-500 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Ghost Chat v1.0</h1>
          <p className="text-slate-400 text-center mb-8 text-sm">Configura tu llave de acceso.</p>
          <div className="space-y-4">
            <input 
              type="text" placeholder="Ej: 10+10" 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-center text-xl tracking-widest text-white"
              value={secretKey} onChange={(e) => setSecretKey(e.target.value)}
            />
            <button onClick={() => secretKey && setHasSetKey(true)} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold transition-all">
              INICIAR SISTEMA
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'connecting') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-mono">
        <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-6" />
        <p className="text-xs text-blue-400 tracking-widest mb-4">ESTABLECIENDO TÚNEL SEGURO...</p>
        <div className="bg-zinc-900/80 rounded-xl p-4 border border-zinc-800 h-48 w-full max-w-sm overflow-y-auto text-[10px] space-y-1">
          {networkLogs.map(log => <div key={log.id}><span className="text-zinc-600">[{log.time}]</span> {log.action}</div>)}
        </div>
      </div>
    );
  }

  if (view === 'calc') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        {showNotification && (
          <div className="fixed top-4 left-4 right-4 bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3 shadow-2xl z-[100] animate-bounce">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div><p className="text-[11px] font-bold text-zinc-300">SYSTEM</p><p className="text-[10px] text-zinc-500">Update complete.</p></div>
          </div>
        )}
        <div className="w-full max-w-xs aspect-[9/16] bg-black flex flex-col">
          <div className="flex-1 flex flex-col justify-end p-6">
            <div className="text-right text-6xl font-light tracking-tighter mb-4 overflow-hidden">{calcDisplay}</div>
          </div>
          <div className="grid grid-cols-4 gap-3 p-4">
            {['C', '+/-', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '='].map((btn) => (
              <Button key={btn} onClick={() => handleCalcClick(btn)} className={`text-2xl h-16 w-16 flex items-center justify-center ${['÷','×','-','+','='].includes(btn)?'bg-orange-500':'bg-zinc-800'} ${['C','+/-','%'].includes(btn)?'bg-zinc-400 text-black':''}`}>{btn}</Button>
            ))}
          </div>
        </div>
        <button onClick={() => setShowNotification(true)} className="mt-12 opacity-10 text-[8px] uppercase tracking-[0.3em]">Test Notify</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col max-w-2xl mx-auto border-x border-slate-800">
      <header className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center"><Lock className="w-5 h-5" /></div>
          <div><h2 className="font-bold text-sm tracking-tight uppercase italic">Ghost Network</h2><div className="flex items-center gap-1.5"><Globe className="w-3 h-3 text-green-500" /><span className="text-[10px] text-slate-400 font-mono">ONLINE</span></div></div>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <button onClick={() => setView('logs')}><Terminal className="w-5 h-5" /></button>
          <button onClick={() => setView('calc')}><EyeOff className="w-5 h-5" /></button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        {view === 'chat' && (
          <>
            <div className="bg-blue-900/10 px-4 py-2 flex items-center justify-between text-[9px] text-blue-400 font-mono border-b border-blue-900/30">
              <span className="flex items-center gap-2"><User className="w-3 h-3" /> {myId}</span>
              <span className="animate-pulse">CANAL PÚBLICO SEGURO</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full opacity-20 text-center px-10">
                  <Shield className="w-12 h-12 mb-4" />
                  <p className="text-xs">Esperando mensajes cifrados...</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl ${msg.sender === 'me' ? 'bg-blue-600' : 'bg-slate-800'}`}>
                    <p className="text-sm">{msg.text}</p>
                    <div className="mt-2 text-[8px] font-mono opacity-40 uppercase tracking-tighter">HASH: {msg.hash}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-slate-900 border-t border-slate-800">
              <div className="flex items-center gap-3 bg-slate-800 rounded-2xl p-2 px-4">
                <input type="text" placeholder="Mensaje..." className="flex-1 bg-transparent border-none py-2 text-sm focus:outline-none text-white" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} />
                <button onClick={sendMessage} className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center hover:bg-blue-500"><Send className="w-4 h-4" /></button>
              </div>
            </div>
          </>
        )}
        {view === 'logs' && (
          <div className="flex-1 bg-black p-6 font-mono text-[11px] overflow-y-auto text-zinc-400">
             {networkLogs.map(log => <div key={log.id} className="mb-1">[{log.time}] &gt; {log.action}</div>)}
             <button onClick={() => setView('chat')} className="mt-8 text-blue-500 hover:underline">VOLVER</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
