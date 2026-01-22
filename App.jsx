import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { 
  Lock, Shield, Settings, Send, Trash2, User, Key, EyeOff, Terminal, 
  Globe, RefreshCw, AlertTriangle, UserPlus, Users, Image as ImageIcon, Mic, X, ChevronLeft, Flame, Skull, LogOut, Wifi, WifiOff, Download, Delete, ToggleLeft, ToggleRight, Save, Eye
} from 'lucide-react';

// --- CONFIGURACIÓN ---
const RELAY_URL = 'wss://ghost-relay-9c9e.onrender.com';
const STORAGE_KEY = 'ghost_vault_v6';

// --- FIX CONSOLA ---
const originalError = console.error;
console.error = (...args) => {
  if (args[0]?.includes?.('ReactDOM.render') || args[0]?.includes?.('createRoot')) return;
  originalError.call(console, ...args);
};

// --- MOTOR CRIPTOGRÁFICO ---
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
  // --- 1. ESTADOS ---
  const [hasLocalVault, setHasLocalVault] = useState(() => { try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }});
  const [isVaultLocked, setIsVaultLocked] = useState(true);
  const [view, setView] = useState('contacts'); 
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isObscured, setIsObscured] = useState(false);
  
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [setupData, setSetupData] = useState({ username: '', equation: '' });
  // Se agrega 'antiScreenshot' a los settings
  const [vaultData, setVaultData] = useState({ username: '', contacts: [], messages: {}, settings: { burnOnRead: false, persistHistory: true, antiScreenshot: false } });
  
  // Refs
  const vaultDataRef = useRef(vaultData);
  const encryptionKeyRef = useRef('');
  const panicCounterRef = useRef(0);
  const lastPanicTapRef = useRef(0);
  
  // UI Chat
  const [activeContact, setActiveContact] = useState(null); 
  const [inputText, setInputText] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [networkLogs, setNetworkLogs] = useState([]);
  
  // Refs DOM/Lógica
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // --- 2. EFECTOS ---

  useEffect(() => { vaultDataRef.current = vaultData; }, [vaultData]);

  useEffect(() => {
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsStandalone(isInStandaloneMode);
    
    // BLOQUEO DE EVENTOS DE CAPTURA/COPIA (GLOBAL)
    const preventDefault = (e) => e.preventDefault();
    document.addEventListener('contextmenu', preventDefault); // Bloquea clic derecho / pulsación larga
    document.addEventListener('dragstart', preventDefault);   // Bloquea arrastrar imágenes
    document.addEventListener('selectstart', preventDefault); // Bloquea seleccionar texto

    // DETECCIÓN DE IMPR PANT (PC)
    const handleKeyDown = (e) => {
        if (e.key === 'PrintScreen') {
            setIsObscured(true); // Pone la pantalla negra antes de que el SO capture
            alert("Captura de pantalla detectada y bloqueada.");
            setTimeout(() => setIsObscured(false), 1000);
        }
    };
    window.addEventListener('keydown', handleKeyDown);

    // ANTI-ESPÍA (VISIBILIDAD)
    const handleVisibilityChange = () => {
      if (document.hidden) setIsObscured(true);
      else setIsObscured(false);
    };
    const handleBlur = () => setIsObscured(true);
    const handleFocus = () => setIsObscured(false);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); setInstallPrompt(e); });

    // ESTILOS INYECTADOS PARA BLOQUEO VISUAL
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.webkitTouchCallout = 'none'; // iOS: Bloquea menú al mantener pulsado

    return () => {
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('dragstart', preventDefault);
      document.removeEventListener('selectstart', preventDefault);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    let interval;
    if (view === 'chat' && activeContact && !isVaultLocked) {
      interval = setInterval(() => {
        const msgs = vaultData.messages[activeContact] || [];
        const now = Date.now();
        const toDelete = msgs.filter(m => m.burn && !m.isMe && (now - m.id > 5000));
        
        if (toDelete.length > 0) {
           const newMsgs = msgs.filter(m => !toDelete.includes(m));
           const newData = { ...vaultData };
           newData.messages[activeContact] = newMsgs;
           setVaultData(newData); 
           saveToVault({ messages: { ...vaultData.messages, [activeContact]: newMsgs } });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [view, activeContact, isVaultLocked, vaultData]);

  // --- 3. FUNCIONES LÓGICAS ---

  const handlePanicTrigger = () => {
    const now = Date.now();
    if (now - lastPanicTapRef.current < 500) {
        panicCounterRef.current += 1;
    } else {
        panicCounterRef.current = 1;
    }
    lastPanicTapRef.current = now;

    if (panicCounterRef.current >= 3) {
      executePanicWipe();
    }
  };

  const executePanicWipe = () => {
    localStorage.clear();
    sessionStorage.clear();
    setVaultData(null);
    window.location.href = "https://google.com";
  };

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
      if (!decrypted.settings) decrypted.settings = { burnOnRead: false, persistHistory: true, antiScreenshot: false };
      encryptionKeyRef.current = calcDisplay; 
      setVaultData(decrypted);
      setIsVaultLocked(false);
      connectToRelay(decrypted.username);
    } else {
      try { setCalcDisplay(String(new Function('return ' + calcDisplay.replace(/×/g, '*').replace(/÷/g, '/'))())); } catch { setCalcDisplay('Error'); }
    }
  };

  const lockVault = async () => {
    if (vaultData.settings?.persistHistory === false) {
        const cleanData = { ...vaultData, messages: {} };
        if (encryptionKeyRef.current) {
            const encrypted = await CryptoUtils.encryptData(cleanData, encryptionKeyRef.current);
            localStorage.setItem(STORAGE_KEY, encrypted);
        }
    }
    setIsVaultLocked(true);
    setCalcDisplay('0');
    encryptionKeyRef.current = ''; 
    if (socketRef.current) socketRef.current.close();
    setIsConnected(false);
    setView('contacts'); 
  };

  const connectToRelay = (user) => {
    if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
      socketRef.current = new WebSocket(RELAY_URL);
      socketRef.current.onopen = () => { 
          setIsConnected(true); 
          socketRef.current.send(JSON.stringify({ type: 'REGISTER', username: user.toLowerCase() })); 
      };
      socketRef.current.onmessage = (e) => handleIncoming(e.data);
      socketRef.current.onclose = () => setIsConnected(false);
    }
  };

  const handleIncoming = (jsonStr) => {
    try {
      const data = JSON.parse(jsonStr);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : ""; 
      const options = mimeType ? { mimeType } : {};
      
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const finalMime = mediaRecorderRef.current.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: finalMime });
        stream.getTracks().forEach(track => track.stop());
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => sendMessage('audio', reader.result);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) {
      alert("Error: Micrófono bloqueado o no disponible.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => sendMessage('image', reader.result);
      reader.readAsDataURL(file);
    }
    e.target.value = ''; 
  };

  const handleCalcClick = (val) => {
    if (val === '=') { 
      if (calcDisplay === '000000') {
        if (confirm("⚠️ ¿RESET DE FÁBRICA?")) {
          localStorage.removeItem(STORAGE_KEY);
          setHasLocalVault(false);
          setVaultData({ username: '', contacts: [], messages: {}, settings: { burnOnRead: false, persistHistory: true } });
          setCalcDisplay('0');
          return;
        }
      }
      hasLocalVault ? attemptUnlock() : (()=>{ try { setCalcDisplay(String(new Function('return ' + calcDisplay.replace(/×/g, '*').replace(/÷/g, '/'))())); } catch { setCalcDisplay('Error'); } })(); 
      return; 
    }
    if (val === 'AC') { setCalcDisplay('0'); return; }
    if (val === 'DEL') { setCalcDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0'); return; }
    setCalcDisplay(prev => (prev === '0' && !isNaN(val) ? val : prev + val));
  };

  const installPWA = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choiceResult) => { if (choiceResult.outcome === 'accepted') setInstallPrompt(null); });
    } else {
      alert("Para instalar: \nAndroid: Menú > Instalar aplicación\niOS: Compartir > Añadir a pantalla de inicio");
    }
  };

  const addContact = () => {
    if (newContactName) {
      const normalizedName = newContactName.trim().toLowerCase();
      const currentContacts = vaultDataRef.current.contacts;
      if (!currentContacts.includes(normalizedName) && normalizedName !== vaultDataRef.current.username) {
        saveToVault({ contacts: [...currentContacts, normalizedName] });
      }
      setNewContactName('');
    }
  };

  const deleteChat = () => {
    if(confirm("¿Eliminar historial con " + activeContact + "?")) {
      const newMessages = { ...vaultData.messages };
      delete newMessages[activeContact];
      saveToVault({ messages: newMessages });
    }
  };

  // --- 4. RENDERIZADO ---

  if (isObscured) {
    return <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center pointer-events-none text-zinc-900 font-mono text-[10px]">PROCESO SEGURO ACTIVO</div>;
  }

  // A. SETUP
  if (!hasLocalVault) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans">
        <Shield className="w-16 h-16 text-blue-600 mb-6 animate-pulse"/>
        <h1 className="text-2xl font-bold mb-2">Setup Seguro</h1>
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

  // B. CALCULADORA (LOCK)
  if (isVaultLocked || isLoading) {
    const calcBtns = [
      { l: 'AC', c: 'bg-zinc-600 text-red-300' }, { l: 'DEL', c: 'bg-zinc-600 text-white', icon: <Delete className="w-6 h-6"/> }, { l: '%', c: 'bg-zinc-600 text-white' }, { l: '÷', c: 'bg-blue-600 text-white font-bold text-2xl' },
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
                <button key={i} onClick={() => handleCalcClick(btn.l)} className={`aspect-square rounded-full flex items-center justify-center text-2xl transition-all active:scale-90 ${btn.c}`}>
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

  // C. AJUSTES
  if (view === 'settings') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col max-w-md mx-auto border-x border-zinc-900 font-sans">
         <header className="p-4 border-b border-zinc-900 bg-black flex items-center gap-3 sticky top-0 z-20">
           <button onClick={() => setView('contacts')}><ChevronLeft/></button>
           <span className="font-bold text-lg">Ajustes de Seguridad</span>
         </header>
         <div className="p-4 space-y-6">
           <div>
             <h3 className="text-zinc-500 text-xs uppercase font-bold mb-3">Privacidad</h3>
             
             {/* TOGGLE: Autodestrucción */}
             <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl mb-2">
               <div className="flex items-center gap-3"><div className="p-2 bg-red-900/20 rounded-lg text-red-500"><Flame className="w-5 h-5"/></div><div><p className="font-medium text-sm">Autodestrucción</p><p className="text-[10px] text-zinc-500">Borrar tras leer (5s)</p></div></div>
               <div onClick={() => saveToVault({ settings: { ...vaultData.settings, burnOnRead: !vaultData.settings?.burnOnRead } })} className="cursor-pointer">
                  {vaultData.settings?.burnOnRead ? <ToggleRight className="w-8 h-8 text-blue-500"/> : <ToggleLeft className="w-8 h-8 text-zinc-600"/>}
               </div>
             </div>

             {/* TOGGLE: Persistencia */}
             <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl mb-2">
               <div className="flex items-center gap-3"><div className="p-2 bg-blue-900/20 rounded-lg text-blue-500"><Globe className="w-5 h-5"/></div><div><p className="font-medium text-sm">Persistencia</p><p className="text-[10px] text-zinc-500">Guardar chats</p></div></div>
               <div onClick={() => saveToVault({ settings: { ...vaultData.settings, persistHistory: !vaultData.settings?.persistHistory } })} className="cursor-pointer">
                  {vaultData.settings?.persistHistory ? <ToggleRight className="w-8 h-8 text-blue-500"/> : <ToggleLeft className="w-8 h-8 text-zinc-600"/>}
               </div>
             </div>

             {/* TOGGLE: Anti-Captura (Blur) */}
             <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl">
               <div className="flex items-center gap-3"><div className="p-2 bg-purple-900/20 rounded-lg text-purple-500"><EyeOff className="w-5 h-5"/></div><div><p className="font-medium text-sm">Anti-Captura (Blur)</p><p className="text-[10px] text-zinc-500">Desenfocar chats</p></div></div>
               <div onClick={() => saveToVault({ settings: { ...vaultData.settings, antiScreenshot: !vaultData.settings?.antiScreenshot } })} className="cursor-pointer">
                  {vaultData.settings?.antiScreenshot ? <ToggleRight className="w-8 h-8 text-purple-500"/> : <ToggleLeft className="w-8 h-8 text-zinc-600"/>}
               </div>
             </div>
           </div>

           <div>
             <h3 className="text-zinc-500 text-xs uppercase font-bold mb-3">Zona de Peligro</h3>
             <button onClick={() => { if(confirm("¿Vaciar todo?")) saveToVault({ messages: {} }); }} className="w-full p-4 bg-zinc-900 rounded-xl flex items-center gap-3 text-red-400 hover:bg-red-900/10 mb-2 transition-colors"><Trash2 className="w-5 h-5"/><span className="text-sm font-medium">Vaciar Historial</span></button>
             <button onClick={() => { if(confirm("¿DETONAR BÓVEDA?")) executePanicWipe(); }} className="w-full p-4 bg-red-900/20 rounded-xl flex items-center gap-3 text-red-500 hover:bg-red-900/30 transition-colors"><Skull className="w-5 h-5"/><span className="text-sm font-bold">DETONAR BÓVEDA</span></button>
           </div>
         </div>
      </div>
    );
  }

  // D. APP - CONTACTOS
  if (view === 'contacts') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col max-w-md mx-auto border-x border-zinc-900 font-sans">
        <header onClick={handlePanicTrigger} className="p-4 border-b border-zinc-900 bg-black flex justify-between items-center sticky top-0 z-20">
          <div className="flex items-center gap-2">
            {isConnected ? <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/> : <div className="w-2 h-2 rounded-full bg-red-500" onClick={() => connectToRelay(vaultData.username)}/>}
            <span className="font-bold text-sm tracking-tight">{vaultData.username?.toUpperCase()}</span>
          </div>
          <div className="flex gap-4">
            <Lock className="w-5 h-5 text-zinc-500 cursor-pointer hover:text-white transition-colors" onClick={lockVault} />
            <Settings className="w-5 h-5 text-zinc-500 cursor-pointer hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); setView('settings'); }}/>
          </div>
        </header>
        <div className="p-4">
          <div className="flex gap-2 mb-6"><input placeholder="ID Amigo..." className="flex-1 bg-zinc-900 rounded-lg px-4 py-3 text-sm outline-none" value={newContactName} onChange={e => setNewContactName(e.target.value)} /><button onClick={addContact} className="bg-blue-600 p-3 rounded-lg hover:bg-blue-500 transition-colors"><UserPlus className="w-5 h-5"/></button></div>
          <div className="space-y-2">
            {vaultData.contacts.map(c => (
              <div key={c} onClick={() => { setActiveContact(c); setView('chat'); }} className="p-4 bg-zinc-900/50 rounded-xl flex justify-between items-center cursor-pointer hover:bg-zinc-900 transition-colors">
                <div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-900 rounded-full flex items-center justify-center font-bold text-sm uppercase">{c[0]}</div><div><h3 className="font-medium">{c}</h3></div></div><ChevronLeft className="rotate-180 w-5 h-5 text-zinc-600"/>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto p-6 text-center border-t border-zinc-900 bg-black">
            <button onClick={() => { if(confirm("¿DETONAR?")) executePanicWipe(); }} className="text-red-900 text-[10px] font-bold border border-red-900/30 px-4 py-2 rounded flex items-center gap-2 mx-auto hover:bg-red-900/10 hover:text-red-500 transition-all">
                <Skull className="w-3 h-3"/> DETONAR BÓVEDA
            </button>
        </div>
      </div>
    );
  }

  // E. APP - CHAT
  if (view === 'chat') {
    const msgs = vaultData.messages[activeContact] || [];
    const burnMode = vaultData.settings?.burnOnRead || false;
    const blurMode = vaultData.settings?.antiScreenshot || false; // Nuevo estado de blur

    return (
      <div className="min-h-screen bg-black text-white flex flex-col max-w-md mx-auto border-x border-zinc-900 font-sans">
        <header onClick={handlePanicTrigger} className="p-3 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3"><button onClick={() => setView('contacts')}><ChevronLeft/></button><span className="font-bold text-sm">{activeContact}</span></div>
          <div className="flex gap-3">
            <button onClick={() => saveToVault({ settings: { ...vaultData.settings, burnOnRead: !burnMode } })} className={`p-2 rounded-full ${burnMode ? 'text-red-500 animate-pulse' : 'text-zinc-600'}`}><Flame className="w-4 h-4"/></button>
            <button onClick={deleteChat} className="text-zinc-600"><Trash2 className="w-4 h-4"/></button>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {msgs.map((msg, i) => (
            <div key={i} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
              <div 
                // Lógica de Blur: Si blurMode está activo Y no es mi mensaje (o si quiero blur en todo), aplicar clase
                className={`max-w-[80%] p-3 rounded-xl relative group ${msg.isMe ? 'bg-blue-900/40 text-blue-100' : 'bg-zinc-800 text-zinc-200'}`}
                // Efecto "Tap to Reveal" usando CSS classes: blur por defecto, quitar blur en active/hover
              >
                <div className={`transition-all duration-200 ${blurMode ? 'blur-sm hover:blur-0 active:blur-0 select-none' : ''}`}>
                    {msg.burn && !msg.isMe ? (
                        <div className="text-red-400 text-xs flex gap-2 animate-pulse"><Flame className="w-3 h-3"/>Autodestrucción...</div>
                    ) : (
                        <>
                            {msg.type === 'image' && <img src={msg.content} className="rounded-lg max-h-48 border border-white/10"/>}
                            {msg.type === 'audio' && <audio controls src={msg.content} className="h-8 w-48"/>}
                            {msg.type === 'text' && <p className="text-sm">{msg.content}</p>}
                        </>
                    )}
                </div>
                {/* Overlay de seguridad si está borroso */}
                {blurMode && <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center opacity-20"><EyeOff className="w-4 h-4"/></div>}
                
                <span className="text-[9px] opacity-30 block text-right mt-1">{msg.timestamp}</span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef}/>
        </div>

        <div className="p-3 border-t border-zinc-900 bg-zinc-950 flex gap-2 items-end">
            <label className="p-3 text-zinc-500"><ImageIcon className="w-5 h-5"/><input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload}/></label>
            
            <input 
                className="flex-1 bg-zinc-900 rounded-xl px-4 py-3 text-sm text-white outline-none" 
                placeholder={burnMode ? "Autodestrucción..." : "Mensaje..."} 
                value={inputText} 
                onChange={e => setInputText(e.target.value)} 
                onKeyPress={e => e.key === 'Enter' && sendMessage('text')}
            />
            
            {inputText.trim() ? (
                <button onClick={() => sendMessage('text')} className="p-3 bg-blue-600 rounded-xl"><Send className="w-5 h-5"/></button>
            ) : (
                <button 
                    onMouseDown={startRecording} 
                    onMouseUp={stopRecording} 
                    onTouchStart={startRecording} 
                    onTouchEnd={stopRecording}
                    className={`p-3 rounded-xl transition-colors ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-zinc-800 text-zinc-400'}`}
                >
                    <Mic className="w-5 h-5"/>
                </button>
            )}
        </div>
      </div>
    );
  }
  return null;
};

const rootElement = document.getElementById('root');
if (rootElement) { try { ReactDOM.unmountComponentAtNode(rootElement); } catch (e) { } ReactDOM.render(<App />, rootElement); }
export default App;

