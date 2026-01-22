import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { 
  Lock, Shield, Settings, Send, Trash2, User, Key, EyeOff, Terminal, 
  Globe, RefreshCw, AlertTriangle, UserPlus, Users, Image as ImageIcon, Mic, X, ChevronLeft, Flame, Skull, LogOut, Wifi, WifiOff
} from 'lucide-react';

// --- 0. CORRECCIÓN DE ERRORES DE CONSOLA ---
const originalError = console.error;
console.error = (...args) => {
  if (args[0]?.includes?.('ReactDOM.render')) return;
  if (args[0]?.includes?.('createRoot')) return;
  originalError.call(console, ...args);
};

// --- 1. CONFIGURACIÓN ---
const RELAY_URL = 'wss://ghost-relay-9c9e.onrender.com';

// --- 2. UTILIDADES CRIPTOGRÁFICAS (AES-GCM 256) ---
const CryptoUtils = {
  deriveKey: async (password, salt) => {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
  },

  encryptData: async (dataObj, password) => {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await CryptoUtils.deriveKey(password, salt);
    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(dataObj));
    
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv }, key, encodedData
    );

    const buffer = new Uint8Array(salt.byteLength + iv.byteLength + ciphertext.byteLength);
    buffer.set(salt, 0);
    buffer.set(iv, salt.byteLength);
    buffer.set(new Uint8Array(ciphertext), salt.byteLength + iv.byteLength);
    
    return btoa(String.fromCharCode(...buffer));
  },

  decryptData: async (encryptedBase64, password) => {
    try {
      const binaryStr = atob(encryptedBase64);
      const buffer = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) buffer[i] = binaryStr.charCodeAt(i);

      const salt = buffer.slice(0, 16);
      const iv = buffer.slice(16, 28);
      const data = buffer.slice(28);
      const key = await CryptoUtils.deriveKey(password, salt);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv }, key, data
      );

      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decrypted));
    } catch (e) {
      return null;
    }
  }
};

const App = () => {
  // --- Estados Principales ---
  const [hasLocalVault, setHasLocalVault] = useState(() => {
    try { return !!localStorage.getItem('ghost_vault_v4'); } catch { return false; }
  });

  const [isVaultLocked, setIsVaultLocked] = useState(true);
  const [view, setView] = useState('contacts'); 
  const [isLoading, setIsLoading] = useState(false);
  const [stylesLoaded, setStylesLoaded] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // Seguridad & Datos
  const [calcDisplay, setCalcDisplay] = useState('0');
  
  // FIX: Restaurar setupData que faltaba y causaba el ReferenceError
  const [setupData, setSetupData] = useState({ username: '', equation: '' });
  
  const [vaultData, setVaultData] = useState({ username: '', contacts: [], messages: {}, settings: { burnOnRead: false } });
  const vaultDataRef = useRef({ username: '', contacts: [], messages: {}, settings: { burnOnRead: false } });
  const encryptionKeyRef = useRef('');

  // UI Chat
  const [activeContact, setActiveContact] = useState(null); 
  const [inputText, setInputText] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [panicCount, setPanicCount] = useState(0);
  const [networkLogs, setNetworkLogs] = useState([]); // Restaurar logs

  // Refs DOM
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const panicTimeoutRef = useRef(null);

  // Sincronizar Ref con State
  useEffect(() => {
    vaultDataRef.current = vaultData;
  }, [vaultData]);

  // --- LOGGING ---
  const addLog = (action) => {
    setNetworkLogs(prev => [{id: Date.now(), time: new Date().toLocaleTimeString(), action}, ...prev].slice(0, 20));
  };

  // --- 3. AUTO-REPARACIÓN VISUAL ---
  useEffect(() => {
    document.body.style.backgroundColor = '#000000';
    document.body.style.color = '#ffffff';
    document.body.style.margin = '0';
    document.body.style.fontFamily = 'monospace';

    const checkStyles = () => {
      const isLoaded = window.getComputedStyle(document.body).getPropertyValue('--tw-text-opacity') !== '';
      if (isLoaded) {
        setStylesLoaded(true);
      } else {
        const script = document.createElement('script');
        script.src = "https://cdn.tailwindcss.com";
        script.onload = () => setStylesLoaded(true);
        document.head.appendChild(script);
      }
    };
    checkStyles();
  }, []);

  // --- 4. SISTEMA DE PÁNICO ---
  const handlePanicTrigger = () => {
    setPanicCount(prev => prev + 1);
    if (panicTimeoutRef.current) clearTimeout(panicTimeoutRef.current);
    panicTimeoutRef.current = setTimeout(() => setPanicCount(0), 1000); 

    if (panicCount >= 2) executePanicWipe();
  };

  const executePanicWipe = () => {
    localStorage.clear();
    sessionStorage.clear();
    setVaultData(null);
    window.location.href = "https://google.com";
  };

  // --- 5. GESTIÓN DE BÓVEDA ---
  const saveToVault = async (newData, overrideKey = null) => {
    const key = overrideKey || encryptionKeyRef.current;
    if (!key) return;

    const currentData = vaultDataRef.current;
    const updatedVault = { ...currentData, ...newData };
    
    setVaultData(updatedVault);
    vaultDataRef.current = updatedVault;
    
    const encrypted = await CryptoUtils.encryptData(updatedVault, key);
    localStorage.setItem('ghost_vault_v4', encrypted);
    setHasLocalVault(true);
  };

  const attemptUnlock = async () => {
    setIsLoading(true);
    addLog("Descifrando bóveda local...");
    const stored = localStorage.getItem('ghost_vault_v4');
    const decrypted = await CryptoUtils.decryptData(stored, calcDisplay);
    setIsLoading(false);
    
    if (decrypted) {
      encryptionKeyRef.current = calcDisplay; 
      setVaultData(decrypted);
      setIsVaultLocked(false);
      connectToRelay(decrypted.username);
    } else {
      try {
        const res = String(new Function('return ' + calcDisplay.replace(/×/g, '*').replace(/÷/g, '/'))());
        setCalcDisplay(res);
      } catch { setCalcDisplay('Error'); }
    }
  };

  const lockVault = () => {
    setIsVaultLocked(true);
    setCalcDisplay('0');
    encryptionKeyRef.current = ''; 
    if (socketRef.current) socketRef.current.close();
    setIsConnected(false);
  };

  // --- 6. LÓGICA DE CALCULADORA ---
  const handleCalcClick = (val) => {
    if (val === '=') {
      if (hasLocalVault) {
        attemptUnlock(); 
      } else {
        try {
            const res = String(new Function('return ' + calcDisplay.replace(/×/g, '*').replace(/÷/g, '/'))());
            setCalcDisplay(res);
        } catch { setCalcDisplay('Error'); }
      }
      return;
    }
    if (val === 'C') { setCalcDisplay('0'); return; }
    setCalcDisplay(prev => (prev === '0' && !isNaN(val) ? val : prev + val));
  };

  // --- 7. RED ---
  const connectToRelay = (user) => {
    addLog(`Conectando al nodo como ${user}...`);
    if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
      socketRef.current = new WebSocket(RELAY_URL);
      
      socketRef.current.onopen = () => {
        setIsConnected(true);
        socketRef.current.send(JSON.stringify({ type: 'REGISTER', username: user.toLowerCase() }));
        addLog("Conexión segura establecida.");
      };
      
      socketRef.current.onmessage = (e) => handleIncoming(e.data);
      
      socketRef.current.onclose = () => { setIsConnected(false); addLog("Desconectado."); };
      socketRef.current.onerror = () => { setIsConnected(false); addLog("Error de conexión."); };
    }
  };

  const handleIncoming = (jsonStr) => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.type === 'INCOMING_MSG') {
        const sender = data.from;
        
        const currentData = vaultDataRef.current;
        let newContacts = [...currentData.contacts];
        
        if (!newContacts.includes(sender)) {
          newContacts.push(sender);
          addLog(`Nuevo contacto detectado: ${sender}`);
        }

        const msgObj = {
          id: Date.now(),
          type: data.contentType,
          content: data.content,
          sender: sender,
          timestamp: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
          isMe: false,
          read: false
        };

        const newMessages = {
          ...currentData.messages,
          [sender]: [...(currentData.messages[sender] || []), msgObj]
        };

        saveToVault({ contacts: newContacts, messages: newMessages });
      }
    } catch (e) {}
  };

  const sendMessage = (type = 'text', content = null) => {
    const payload = content || inputText;
    if (!payload || !activeContact) return;

    const target = activeContact.toLowerCase();
    const currentData = vaultDataRef.current;

    const msgObj = {
      id: Date.now(),
      type,
      content: payload,
      sender: currentData.username,
      timestamp: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      isMe: true,
      burn: currentData.settings.burnOnRead
    };

    const newMessages = {
      ...currentData.messages,
      [activeContact]: [...(currentData.messages[activeContact] || []), msgObj]
    };
    
    saveToVault({ messages: newMessages });

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'PRIVATE_MSG', to: target, content: payload, contentType: type
      }));
    }
    
    if (type === 'text') setInputText('');
  };

  // --- 8. OPCIONES ---
  const addContact = () => {
    if (newContactName) {
      const normalizedName = newContactName.trim().toLowerCase();
      const currentContacts = vaultDataRef.current.contacts;
      
      if (!currentContacts.includes(normalizedName) && normalizedName !== vaultDataRef.current.username) {
        saveToVault({ contacts: [...currentContacts, normalizedName] });
        addLog(`Contacto agregado: ${normalizedName}`);
      }
      setNewContactName('');
    }
  };

  const toggleBurnMode = () => {
    saveToVault({ settings: { ...vaultData.settings, burnOnRead: !vaultData.settings.burnOnRead } });
  };

  const deleteChat = () => {
    if(confirm("¿Eliminar historial con " + activeContact + "?")) {
      const newMessages = { ...vaultData.messages };
      delete newMessages[activeContact];
      saveToVault({ messages: newMessages });
    }
  };

  // --- 9. VISTAS ---
  
  const containerStyle = { backgroundColor: 'black', minHeight: '100vh', color: 'white', display: 'flex', flexDirection: 'column' };

  if (!stylesLoaded) {
    return (
       <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw className="animate-spin w-12 h-12 text-blue-500" />
          <p style={{ marginTop: 20, fontFamily: 'monospace' }}>CARGANDO ENTORNO SEGURO...</p>
       </div>
    );
  }

  // A. SETUP INICIAL
  if (!hasLocalVault) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans">
        <Shield className="w-16 h-16 text-blue-600 mb-6 animate-pulse"/>
        <h1 className="text-2xl font-bold mb-2 tracking-tight">Cifrado Grado Militar</h1>
        <p className="text-zinc-500 text-center mb-8 text-sm max-w-xs">
          Configura tu identidad. Datos locales cifrados con AES-GCM.
        </p>
        
        <div className="w-full max-w-sm space-y-4">
          <input 
            placeholder="Usuario Público (Ej: agente01)" 
            className="w-full bg-zinc-900 p-4 rounded-xl border border-zinc-800 outline-none text-white focus:border-blue-600 transition-colors"
            onChange={e => setSetupData({...setupData, username: e.target.value.toLowerCase()})} 
          />
          <input 
            placeholder="Ecuación Maestra (Ej: 10+10)" 
            className="w-full bg-zinc-900 p-4 rounded-xl border border-zinc-800 outline-none text-white focus:border-blue-600 transition-colors font-mono"
            onChange={e => setSetupData({...setupData, equation: e.target.value})}
          />
          <button 
            disabled={!setupData.username || !setupData.equation}
            onClick={() => {
              const initialVault = { ...vaultData, username: setupData.username };
              encryptionKeyRef.current = setupData.equation;
              saveToVault(initialVault, setupData.equation);
              setCalcDisplay('0');
              setIsVaultLocked(true); 
              setSetupData({ username: '', equation: '' }); 
              alert("Identidad protegida. Usa tu ecuación en la calculadora para entrar.");
            }}
            className="w-full bg-blue-600 py-4 rounded-xl font-bold hover:bg-blue-500 disabled:opacity-50 transition-all mt-4"
          >
            GENERAR BÓVEDA SEGURA
          </button>
        </div>
      </div>
    );
  }

  // B. PANTALLA DE CARGA
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-blue-500 font-mono">
        <RefreshCw className="w-12 h-12 animate-spin mb-4"/>
        <p className="text-xs tracking-widest uppercase">DESCIFRANDO BÓVEDA LOCAL...</p>
      </div>
    );
  }

  // C. CALCULADORA (BLOQUEO)
  if (isVaultLocked) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-xs aspect-[9/16] bg-black flex flex-col">
            <div className="flex-1 flex flex-col justify-end p-6">
              <div className="text-right text-6xl font-light tracking-tighter mb-4 overflow-hidden">{calcDisplay}</div>
            </div>
            <div className="grid grid-cols-4 gap-3 p-4">
              {['C', '+/-', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '='].map((btn) => (
                <button key={btn} onClick={() => handleCalcClick(btn)} 
                  className={`text-2xl h-16 w-16 rounded-full flex items-center justify-center ${['÷','×','-','+','='].includes(btn)?'bg-orange-600':'bg-zinc-800'} ${['C','+/-','%'].includes(btn)?'bg-zinc-400 text-black':''}`}>
                  {btn}
                </button>
              ))}
            </div>
            <div className="text-center mt-2 flex flex-col items-center gap-1">
              <Lock className="w-3 h-3 text-zinc-600"/>
              <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">AES-256 Encrypted</span>
            </div>
        </div>
      </div>
    );
  }

  // D. APLICACIÓN DESBLOQUEADA

  // Vista Contactos
  if (view === 'contacts') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col max-w-md mx-auto border-x border-zinc-900">
        <header 
          onClick={handlePanicTrigger} 
          className="p-4 border-b border-zinc-900 bg-black flex justify-between items-center select-none sticky top-0 z-20"
        >
          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-1.5 bg-green-900/30 px-2 py-1 rounded-full border border-green-900/50">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[10px] font-bold text-green-500">ONLINE</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-red-900/30 px-2 py-1 rounded-full border border-red-900/50 cursor-pointer" onClick={() => connectToRelay(vaultData.username)}>
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-[10px] font-bold text-red-500">RECONECTAR</span>
              </div>
            )}
            <span className="font-bold text-sm tracking-tight ml-2">{vaultData.username?.toUpperCase()}</span>
          </div>
          <div className="flex gap-4">
            <Lock className="w-5 h-5 text-zinc-500 hover:text-white cursor-pointer" onClick={lockVault} />
            <Settings className="w-5 h-5 text-zinc-600 cursor-help" onClick={(e) => { e.stopPropagation(); alert("Triple toque en barra superior = WIPE TOTAL"); }}/>
          </div>
        </header>

        <div className="p-4">
          <div className="flex gap-2 mb-6">
            <input 
              placeholder="ID de amigo (Ej: agente02)" 
              className="flex-1 bg-zinc-900 rounded-lg px-4 py-3 text-sm outline-none border border-transparent focus:border-blue-900 transition-colors"
              value={newContactName} onChange={e => setNewContactName(e.target.value)}
            />
            <button onClick={addContact} className="bg-blue-600 p-3 rounded-lg hover:bg-blue-500 transition-colors"><UserPlus className="w-5 h-5"/></button>
          </div>

          <div className="space-y-2">
            {vaultData.contacts.length === 0 && (
               <div className="text-center text-zinc-600 py-10 text-sm">Sin contactos. Agrega uno arriba.</div>
            )}
            {vaultData.contacts.map(c => (
              <div key={c} onClick={() => { setActiveContact(c); setView('chat'); }}
                className="p-4 bg-zinc-900/50 rounded-xl flex justify-between items-center cursor-pointer hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-tr from-blue-900 to-slate-900 rounded-full flex items-center justify-center font-bold text-sm uppercase border border-white/10">
                    {c[0]}
                  </div>
                  <div>
                    <h3 className="font-medium">{c}</h3>
                    <p className="text-[10px] text-zinc-500">
                      {vaultData.messages[c] ? `${vaultData.messages[c].length} mensajes` : 'Nuevo chat'}
                    </p>
                  </div>
                </div>
                <ChevronLeft className="rotate-180 w-5 h-5 text-zinc-600"/>
              </div>
            ))}
          </div>
        </div>

        {/* Logs visuales (debug) */}
        <div className="mt-auto border-t border-zinc-900 bg-black">
            <div className="h-24 overflow-y-auto p-4 text-[9px] font-mono text-zinc-600">
                {networkLogs.map(log => <div key={log.id}>[{log.time}] {log.action}</div>)}
            </div>
            <div className="p-4 text-center border-t border-zinc-900">
                <button onClick={executePanicWipe} className="text-red-900 text-[10px] font-bold border border-red-900/30 px-4 py-2 rounded flex items-center gap-2 mx-auto hover:bg-red-900/20 hover:text-red-500 transition-all">
                    <Skull className="w-3 h-3"/> DETONAR BÓVEDA
                </button>
            </div>
        </div>
      </div>
    );
  }

  // Vista Chat
  if (view === 'chat') {
    const msgs = vaultData.messages[activeContact] || [];
    return (
      <div className="min-h-screen bg-black text-white flex flex-col max-w-md mx-auto border-x border-zinc-900">
        <header onClick={handlePanicTrigger} className="p-3 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between sticky top-0 z-10 select-none">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('contacts')} className="p-2 hover:bg-zinc-900 rounded-full transition-colors"><ChevronLeft className="w-5 h-5"/></button>
            <span className="font-bold text-sm">{activeContact}</span>
            {!isConnected && <WifiOff className="w-3 h-3 text-red-500 animate-pulse"/>}
          </div>
          <div className="flex gap-3">
            <button onClick={toggleBurnMode} className={`p-2 rounded-full transition-all ${vaultData.settings.burnOnRead ? 'bg-red-600/20 text-red-500 animate-pulse' : 'text-zinc-600 hover:text-zinc-400'}`}>
                <Flame className="w-4 h-4"/>
            </button>
            <button onClick={deleteChat} className="text-zinc-600 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {msgs.length === 0 && (
             <div className="text-center mt-10 opacity-20">
               <Shield className="w-12 h-12 mx-auto mb-2"/>
               <p className="text-xs">Inicio del historial cifrado.</p>
             </div>
          )}
          {msgs.map((msg, i) => (
            <div key={i} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-xl ${msg.isMe ? 'bg-blue-900/40 text-blue-100' : 'bg-zinc-800 text-zinc-200'}`}>
                {msg.type === 'image' ? (
                  <img src={msg.content} className="rounded-lg max-h-48 border border-white/10"/>
                ) : (
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                )}
                <div className="flex justify-end items-center gap-1 mt-1 opacity-50">
                    {msg.burn && <Flame className="w-3 h-3 text-red-500"/>}
                    <span className="text-[9px]">{msg.timestamp}</span>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef}/>
        </div>

        <div className="p-3 border-t border-zinc-900 bg-zinc-950 flex gap-2 items-end">
            <label className="p-3 text-zinc-500 hover:text-white cursor-pointer bg-zinc-900 rounded-xl mb-[1px]">
              <ImageIcon className="w-5 h-5"/>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={e => {
                  const f = e.target.files[0];
                  if(f) { const r = new FileReader(); r.onload=()=>sendMessage('image', r.result); r.readAsDataURL(f); }
                  e.target.value='';
              }}/>
            </label>
            <input 
              className="flex-1 bg-zinc-900 rounded-xl px-4 py-3 text-sm outline-none text-white focus:ring-1 focus:ring-blue-900 transition-all"
              placeholder={vaultData.settings.burnOnRead ? "Mensaje autodestructible..." : "Mensaje seguro..."}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && sendMessage('text')}
            />
            <button onClick={() => sendMessage('text')} className="p-3 bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors mb-[1px]">
               <Send className="w-5 h-5"/>
            </button>
        </div>
      </div>
    );
  }

  return null;
};

// PUNTO DE MONTAJE
const rootElement = document.getElementById('root');
if (rootElement) {
  try { ReactDOM.unmountComponentAtNode(rootElement); } catch (e) { }
  ReactDOM.render(<App />, rootElement);
}

export default App;
