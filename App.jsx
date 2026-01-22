import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { 
  Lock, Shield, Settings, Send, Trash2, User, Key, EyeOff, Terminal, 
  Globe, RefreshCw, AlertTriangle, UserPlus, Users, Image as ImageIcon, Mic, X, ChevronLeft, Flame, Skull, LogOut, Wifi, WifiOff, Download, Delete
} from 'lucide-react';

// --- FIX CONSOLA ---
const originalError = console.error;
console.error = (...args) => {
  if (args[0]?.includes?.('ReactDOM.render') || args[0]?.includes?.('createRoot')) return;
  originalError.call(console, ...args);
};

// --- CONFIGURACIÓN ---
const RELAY_URL = 'wss://ghost-relay-9c9e.onrender.com';
const STORAGE_KEY = 'ghost_vault_v6'; // Nueva versión para asegurar limpieza

// --- CRYPTO ---
const CryptoUtils = {
  deriveKey: async (password, salt) => {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
    return window.crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  },
  encryptData: async (dataObj, password) => {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await CryptoUtils.deriveKey(password, salt);
    const enc = new TextEncoder();
    const ciphertext = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(dataObj)));
    const buffer = new Uint8Array(salt.byteLength + iv.byteLength + ciphertext.byteLength);
    buffer.set(salt, 0); buffer.set(iv, salt.byteLength); buffer.set(new Uint8Array(ciphertext), salt.byteLength + iv.byteLength);
    return btoa(String.fromCharCode(...buffer));
  },
  decryptData: async (encryptedBase64, password) => {
    try {
      const binaryStr = atob(encryptedBase64);
      const buffer = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) buffer[i] = binaryStr.charCodeAt(i);
      const key = await CryptoUtils.deriveKey(password, buffer.slice(0, 16));
      const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: buffer.slice(16, 28) }, key, buffer.slice(28));
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) { return null; }
  }
};

const App = () => {
  const [hasLocalVault, setHasLocalVault] = useState(() => { try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }});
  const [isVaultLocked, setIsVaultLocked] = useState(true);
  const [view, setView] = useState('contacts'); 
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [setupData, setSetupData] = useState({ username: '', equation: '' });
  const [vaultData, setVaultData] = useState({ username: '', contacts: [], messages: {}, settings: { burnOnRead: false } });
  
  const vaultDataRef = useRef(vaultData);
  const encryptionKeyRef = useRef('');
  
  const [activeContact, setActiveContact] = useState(null); 
  const [inputText, setInputText] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [panicCount, setPanicCount] = useState(0);
  
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const panicTimeoutRef = useRef(null);

  useEffect(() => { vaultDataRef.current = vaultData; }, [vaultData]);

  // --- LOGICA INSTALACIÓN ---
  useEffect(() => {
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsStandalone(isInStandaloneMode);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });
  }, []);

  // --- LOGICA PÁNICO ---
  const handlePanicTrigger = () => {
    setPanicCount(prev => prev + 1);
    if (panicTimeoutRef.current) clearTimeout(panicTimeoutRef.current);
    panicTimeoutRef.current = setTimeout(() => setPanicCount(0), 1000); 
    if (panicCount >= 2) {
      localStorage.clear(); sessionStorage.clear(); setVaultData(null); window.location.href = "https://google.com";
    }
  };

  // --- LOGICA BÓVEDA ---
  const saveToVault = async (newData, overrideKey = null) => {
    const key = overrideKey || encryptionKeyRef.current;
    if (!key) return;
    const updatedVault = { ...vaultDataRef.current, ...newData };
    setVaultData(updatedVault);
    const encrypted = await CryptoUtils.encryptData(updatedVault, key);
    localStorage.setItem(STORAGE_KEY, encrypted);
    setHasLocalVault(true);
  };

  const attemptUnlock = async () => {
    setIsLoading(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    const decrypted = await CryptoUtils.decryptData(stored, calcDisplay);
    setIsLoading(false);
    if (decrypted) {
      encryptionKeyRef.current = calcDisplay; 
      setVaultData(decrypted);
      setIsVaultLocked(false);
      connectToRelay(decrypted.username);
    } else {
      try { setCalcDisplay(String(new Function('return ' + calcDisplay.replace(/×/g, '*').replace(/÷/g, '/'))())); } catch { setCalcDisplay('Error'); }
    }
  };

  const connectToRelay = (user) => {
    if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
      socketRef.current = new WebSocket(RELAY_URL);
      socketRef.current.onopen = () => { setIsConnected(true); socketRef.current.send(JSON.stringify({ type: 'REGISTER', username: user.toLowerCase() })); };
      socketRef.current.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'INCOMING_MSG') {
            const sender = data.from;
            const currentData = vaultDataRef.current;
            let newContacts = [...currentData.contacts];
            if (!newContacts.includes(sender)) newContacts.push(sender);
            
            const msgObj = {
              id: Date.now(),
              type: data.contentType, content: data.content, sender: sender,
              timestamp: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
              isMe: false, read: false, burn: data.burn
            };
            saveToVault({ contacts: newContacts, messages: { ...currentData.messages, [sender]: [...(currentData.messages[sender] || []), msgObj] } });
          }
        } catch (e) {}
      };
      socketRef.current.onclose = () => setIsConnected(false);
    }
  };

  const sendMessage = (type = 'text', content = null) => {
    const payload = content || inputText;
    if (!payload || !activeContact) return;
    const target = activeContact.toLowerCase();
    const currentData = vaultDataRef.current;
    
    const msgObj = {
      id: Date.now(), type, content: payload, sender: currentData.username,
      timestamp: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      isMe: true, burn: currentData.settings.burnOnRead
    };
    saveToVault({ messages: { ...currentData.messages, [activeContact]: [...(currentData.messages[activeContact] || []), msgObj] } });

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'PRIVATE_MSG', to: target, content: payload, contentType: type, burn: currentData.settings.burnOnRead }));
    }
    if (type === 'text') setInputText('');
  };

  const handleCalcClick = (val) => {
    if (val === '=') { hasLocalVault ? attemptUnlock() : (()=>{ try { setCalcDisplay(String(new Function('return ' + calcDisplay.replace(/×/g, '*').replace(/÷/g, '/'))())); } catch { setCalcDisplay('Error'); } })(); return; }
    if (val === 'AC') { setCalcDisplay('0'); return; }
    if (val === 'DEL') { setCalcDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0'); return; }
    setCalcDisplay(prev => (prev === '0' && !isNaN(val) ? val : prev + val));
  };

  const installPWA = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choiceResult) => { 
        if (choiceResult.outcome === 'accepted') setInstallPrompt(null); 
      });
    } else {
      alert("Instalación manual:\nAndroid: Menú > Instalar aplicación\niOS: Compartir > Añadir a pantalla de inicio");
    }
  };

  const lockVault = () => {
    setIsVaultLocked(true);
    setCalcDisplay('0');
    encryptionKeyRef.current = ''; 
    if (socketRef.current) socketRef.current.close();
    setIsConnected(false);
  };

  // --- VISTAS ---
  if (!hasLocalVault) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans">
        <Shield className="w-16 h-16 text-blue-600 mb-6 animate-pulse"/>
        <h1 className="text-2xl font-bold mb-2">Configuración Segura</h1>
        <div className="w-full max-w-sm space-y-4">
          <input placeholder="Usuario (Ej: agente01)" className="w-full bg-zinc-900 p-4 rounded-xl text-white outline-none" onChange={e => setSetupData({...setupData, username: e.target.value.toLowerCase()})} />
          <input placeholder="Ecuación (Clave)" className="w-full bg-zinc-900 p-4 rounded-xl text-white outline-none font-mono" onChange={e => setSetupData({...setupData, equation: e.target.value})} />
          <button disabled={!setupData.username || !setupData.equation} onClick={() => {
              encryptionKeyRef.current = setupData.equation;
              saveToVault({ ...vaultData, username: setupData.username }, setupData.equation);
              setCalcDisplay('0'); setIsVaultLocked(true); setSetupData({ username: '', equation: '' });
              alert("Bóveda creada. Usa la calculadora para entrar.");
            }} className="w-full bg-blue-600 py-4 rounded-xl font-bold mt-4 disabled:opacity-50">CREAR BÓVEDA</button>
        </div>
      </div>
    );
  }

  if (isVaultLocked || isLoading) {
    // DISEÑO ANDROID NATIVO
    const calcBtns = [
      { l: 'AC', c: 'bg-zinc-600 text-red-300' }, 
      { l: 'DEL', c: 'bg-zinc-600 text-white', icon: <Delete className="w-6 h-6"/> }, 
      { l: '%', c: 'bg-zinc-600 text-white' }, 
      { l: '÷', c: 'bg-blue-600 text-white font-bold text-2xl' },
      { l: '7', c: 'bg-zinc-800 text-white' }, { l: '8', c: 'bg-zinc-800 text-white' }, { l: '9', c: 'bg-zinc-800 text-white' }, { l: '×', c: 'bg-blue-600 text-white font-bold text-2xl' },
      { l: '4', c: 'bg-zinc-800 text-white' }, { l: '5', c: 'bg-zinc-800 text-white' }, { l: '6', c: 'bg-zinc-800 text-white' }, { l: '-', c: 'bg-blue-600 text-white font-bold text-2xl' },
      { l: '1', c: 'bg-zinc-800 text-white' }, { l: '2', c: 'bg-zinc-800 text-white' }, { l: '3', c: 'bg-zinc-800 text-white' }, { l: '+', c: 'bg-blue-600 text-white font-bold text-2xl' },
      { l: '.', c: 'bg-zinc-800 text-white' }, { l: '0', c: 'bg-zinc-800 text-white' }, { l: '00', c: 'bg-zinc-800 text-white text-sm' }, { l: '=', c: 'bg-blue-400 text-black font-bold text-2xl' }
    ];

    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-end pb-6 px-4 font-sans">
        {isLoading ? <div className="flex-1 flex items-center justify-center"><RefreshCw className="w-12 h-12 animate-spin text-blue-500"/></div> : (
          <>
            <div className="flex-1 flex flex-col justify-end p-4 pb-12">
              <div className="text-right text-7xl font-light tracking-tight overflow-hidden break-all leading-none">{calcDisplay}</div>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {calcBtns.map((btn, i) => (
                <button 
                  key={i} 
                  onClick={() => handleCalcClick(btn.l)} 
                  className={`aspect-square rounded-full flex items-center justify-center text-2xl transition-all active:scale-90 ${btn.c}`}
                >
                  {btn.icon || btn.l}
                </button>
              ))}
            </div>
            {(!isStandalone && installPrompt) && (
              <div onClick={installPWA} className="py-4 text-center text-zinc-500 text-xs uppercase tracking-widest cursor-pointer animate-pulse">
                 Instalar Calculadora
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // --- APP DESBLOQUEADA ---
  if (view === 'contacts') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col max-w-md mx-auto border-x border-zinc-900 font-sans">
        <header onClick={handlePanicTrigger} className="p-4 border-b border-zinc-900 bg-black flex justify-between items-center sticky top-0 z-20">
          <div className="flex items-center gap-2">
            {isConnected ? <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/> : <div className="w-2 h-2 rounded-full bg-red-500" onClick={() => connectToRelay(vaultData.username)}/>}
            <span className="font-bold text-sm tracking-tight">{vaultData.username?.toUpperCase()}</span>
          </div>
          <div className="flex gap-4"><Lock className="w-5 h-5 text-zinc-500 cursor-pointer" onClick={lockVault} /><Settings className="w-5 h-5 text-zinc-600"/></div>
        </header>
        <div className="p-4">
          <div className="flex gap-2 mb-6"><input placeholder="ID Amigo..." className="flex-1 bg-zinc-900 rounded-lg px-4 py-3 text-sm outline-none" value={newContactName} onChange={e => setNewContactName(e.target.value)} /><button onClick={() => { if(newContactName && !vaultData.contacts.includes(newContactName.toLowerCase())) saveToVault({ contacts: [...vaultData.contacts, newContactName.toLowerCase()] }); setNewContactName(''); }} className="bg-blue-600 p-3 rounded-lg"><UserPlus className="w-5 h-5"/></button></div>
          <div className="space-y-2">
            {vaultData.contacts.map(c => (
              <div key={c} onClick={() => { setActiveContact(c); setView('chat'); }} className="p-4 bg-zinc-900/50 rounded-xl flex justify-between items-center cursor-pointer hover:bg-zinc-900">
                <div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-900 rounded-full flex items-center justify-center font-bold text-sm uppercase">{c[0]}</div><div><h3 className="font-medium">{c}</h3></div></div><ChevronLeft className="rotate-180 w-5 h-5 text-zinc-600"/>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto p-6 text-center border-t border-zinc-900 bg-black"><button onClick={handlePanicTrigger} className="text-red-900 text-[10px] font-bold border border-red-900/30 px-4 py-2 rounded flex items-center gap-2 mx-auto"><Skull className="w-3 h-3"/> DETONAR BÓVEDA</button></div>
      </div>
    );
  }

  if (view === 'chat') {
    const msgs = vaultData.messages[activeContact] || [];
    useEffect(() => {
      const interval = setInterval(() => {
        const now = Date.now();
        const toDelete = msgs.filter(m => m.burn && !m.isMe && (now - m.id > 5000));
        if (toDelete.length > 0) {
           const newMsgs = msgs.filter(m => !toDelete.includes(m));
           saveToVault({ messages: { ...vaultData.messages, [activeContact]: newMsgs } });
        }
      }, 1000);
      return () => clearInterval(interval);
    }, [msgs, activeContact]);

    return (
      <div className="min-h-screen bg-black text-white flex flex-col max-w-md mx-auto border-x border-zinc-900 font-sans">
        <header onClick={handlePanicTrigger} className="p-3 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3"><button onClick={() => setView('contacts')}><ChevronLeft/></button><span className="font-bold text-sm">{activeContact}</span></div>
          <div className="flex gap-3"><button onClick={() => saveToVault({ settings: { ...vaultData.settings, burnOnRead: !vaultData.settings.burnOnRead } })} className={`p-2 rounded-full ${vaultData.settings.burnOnRead ? 'text-red-500 animate-pulse' : 'text-zinc-600'}`}><Flame className="w-4 h-4"/></button><button onClick={() => { if(confirm("¿Borrar?")) { const m = {...vaultData.messages}; delete m[activeContact]; saveToVault({messages:m}); }}} className="text-zinc-600"><Trash2 className="w-4 h-4"/></button></div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {msgs.map((msg, i) => (
            <div key={i} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-xl ${msg.isMe ? 'bg-blue-900/40 text-blue-100' : 'bg-zinc-800 text-zinc-200'}`}>
                {msg.burn && !msg.isMe ? <div className="text-red-400 text-xs flex gap-2 animate-pulse"><Flame className="w-3 h-3"/>Autodestrucción... <span className="blur-sm hover:blur-0 cursor-pointer text-white">{msg.content}</span></div> : (msg.type === 'image' ? <img src={msg.content} className="rounded-lg max-h-48"/> : <p className="text-sm">{msg.content}</p>)}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef}/>
        </div>
        <div className="p-3 border-t border-zinc-900 bg-zinc-950 flex gap-2 items-end">
            <label className="p-3 text-zinc-500"><ImageIcon className="w-5 h-5"/><input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={e => { if(e.target.files[0]) { const r = new FileReader(); r.onload=()=>sendMessage('image', r.result); r.readAsDataURL(e.target.files[0]); } e.target.value=''; }}/></label>
            <input className="flex-1 bg-zinc-900 rounded-xl px-4 py-3 text-sm text-white outline-none" placeholder={vaultData.settings.burnOnRead ? "Autodestrucción..." : "Mensaje..."} value={inputText} onChange={e => setInputText(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage('text')}/>
            <button onClick={() => sendMessage('text')} className="p-3 bg-blue-600 rounded-xl"><Send className="w-5 h-5"/></button>
        </div>
      </div>
    );
  }
  return null;
};

const rootElement = document.getElementById('root');
if (rootElement) { try { ReactDOM.unmountComponentAtNode(rootElement); } catch (e) { } ReactDOM.render(<App />, rootElement); }
export default App;
