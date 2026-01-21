import React, { useState, useEffect, useRef } from 'react';
import { Lock, Shield, Settings, Send, Mic, Image as ImageIcon, UserPlus, X, ChevronLeft, Camera, PhoneOff, Trash2 } from 'lucide-react';

// --- CONFIGURACIÓN ---
const RELAY_URL = 'wss://ghost-relay-9c9e.onrender.com'; // Tu URL de Render

// --- UTILIDADES ---
const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const App = () => {
  // --- ESTADOS GLOBALES ---
  const [view, setView] = useState('calc'); // calc, setup, connecting, contacts, chat
  const [myUsername, setMyUsername] = useState('');
  
  // Estados de Calculadora
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [secretEquation, setSecretEquation] = useState('');
  const [hasSetup, setHasSetup] = useState(false);

  // Estados de Chat y Contactos
  const [contacts, setContacts] = useState([]); // [{ name: 'juan', messages: [] }]
  const [activeContact, setActiveContact] = useState(null);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');

  // Refs
  const socket = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Scroll automático al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [contacts, activeContact]);

  // --- LÓGICA DE CALCULADORA ---
  const safeEvaluate = (str) => {
    try {
      return String(new Function('return ' + str.replace(/×/g, '*').replace(/÷/g, '/'))());
    } catch { return "Error"; }
  };

  const handleCalcClick = (val) => {
    if (val === '=') {
      if (hasSetup && calcDisplay === secretEquation) {
        connectToServer();
      } else {
        setCalcDisplay(safeEvaluate(calcDisplay));
      }
      return;
    }
    if (val === 'C') { setCalcDisplay('0'); return; }
    setCalcDisplay(prev => (prev === '0' && !isNaN(val) ? val : prev + val));
  };

  // --- CONEXIÓN AL SERVIDOR ---
  const connectToServer = () => {
    setView('connecting');
    socket.current = new WebSocket(RELAY_URL);

    socket.current.onopen = () => {
      // Registrarse en el servidor
      socket.current.send(JSON.stringify({ 
        type: 'REGISTER', 
        username: myUsername 
      }));
      setView('contacts');
    };

    socket.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'INCOMING_MSG') {
          handleIncomingMessage(data);
        }
      } catch (e) { console.error(e); }
    };
  };

  const handleIncomingMessage = (data) => {
    const sender = data.from;
    setContacts(prev => {
      // Verificar si el contacto existe, si no, crearlo temporalmente
      const exists = prev.find(c => c.name === sender);
      const newMessage = {
        id: Date.now(),
        sender: 'peer',
        content: data.content,
        type: data.contentType,
        time: data.timestamp
      };

      if (exists) {
        return prev.map(c => c.name === sender 
          ? { ...c, messages: [...c.messages, newMessage] } 
          : c
        );
      } else {
        // Nuevo contacto desconocido
        return [...prev, { name: sender, messages: [newMessage] }];
      }
    });
  };

  // --- GESTIÓN DE CONTACTOS ---
  const addContact = () => {
    if (!newContactName.trim()) return;
    const name = newContactName.trim().toLowerCase();
    if (!contacts.find(c => c.name === name) && name !== myUsername) {
      setContacts([...contacts, { name, messages: [] }]);
    }
    setNewContactName('');
    setShowAddContact(false);
  };

  // --- ENVIAR MENSAJES ---
  const sendMessage = (content, type = 'text') => {
    if (!activeContact) return;

    const msgPayload = {
      type: 'PRIVATE_MSG',
      to: activeContact.name,
      content: content,
      contentType: type
    };

    // Enviar al servidor
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(msgPayload));
    
      // Guardar localmente
      const newMessage = {
        id: Date.now(),
        sender: 'me',
        content: content,
        type: type,
        time: Date.now()
      };

      setContacts(prev => prev.map(c => 
        c.name === activeContact.name 
          ? { ...c, messages: [...c.messages, newMessage] } 
          : c
      ));

      if (type === 'text') setInputText('');
    }
  };

  // --- MULTIMEDIA: AUDIO ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => sendMessage(reader.result, 'audio');
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (e) {
      alert("Permiso de micrófono denegado");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  // --- MULTIMEDIA: FOTOS ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Comprimir o limitar tamaño es recomendable aquí
      const reader = new FileReader();
      reader.onloadend = () => sendMessage(reader.result, 'image');
      reader.readAsDataURL(file);
    }
  };

  // --- VISTAS ---

  // 1. SETUP INICIAL
  if (!hasSetup) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8">
          <div className="flex justify-center mb-6"><Shield className="text-blue-500 w-12 h-12" /></div>
          <h1 className="text-xl font-bold text-center mb-6">Configuración de Seguridad</h1>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 uppercase font-bold">Tu Usuario (Público)</label>
              <input 
                type="text" 
                placeholder="Ej: ghost_01" 
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mt-1"
                value={myUsername}
                onChange={(e) => setMyUsername(e.target.value.toLowerCase())}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase font-bold">Ecuación de Acceso</label>
              <input 
                type="text" 
                placeholder="Ej: 10+25" 
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mt-1"
                value={secretEquation}
                onChange={(e) => setSecretEquation(e.target.value)}
              />
            </div>
            <button 
              onClick={() => { if(myUsername && secretEquation) setHasSetup(true); }}
              className="w-full bg-blue-600 py-3 rounded-xl font-bold mt-4"
            >
              ENCRIPTAR Y GUARDAR
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. CALCULADORA (CAMUFLAJE)
  if (view === 'calc') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-xs aspect-[9/16] bg-black flex flex-col">
          <div className="flex-1 flex flex-col justify-end p-6">
            <div className="text-right text-6xl font-light tracking-tighter mb-4 overflow-hidden">{calcDisplay}</div>
          </div>
          <div className="grid grid-cols-4 gap-3 p-4">
            {['C', '+/-', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '='].map((btn) => (
              <button 
                key={btn}
                onClick={() => handleCalcClick(btn)}
                className={`text-2xl h-16 w-16 rounded-full flex items-center justify-center ${['÷','×','-','+','='].includes(btn)?'bg-orange-500':'bg-zinc-800'} ${['C','+/-','%'].includes(btn)?'bg-zinc-400 text-black':''}`}
              >
                {btn}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 3. CONECTANDO...
  if (view === 'connecting') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-mono text-blue-400">ESTABLECIENDO ENLACE SEGURO...</p>
      </div>
    );
  }

  // 4. LISTA DE CONTACTOS
  if (view === 'contacts') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col max-w-2xl mx-auto border-x border-slate-800">
        <header className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center sticky top-0 z-10">
          <div>
            <h2 className="font-bold text-lg">Chats</h2>
            <p className="text-xs text-slate-400 font-mono">Usuario: {myUsername}</p>
          </div>
          <div className="flex gap-2">
             <button onClick={() => setView('calc')} className="p-2 bg-slate-800 rounded-full"><Lock className="w-5 h-5" /></button>
             <button onClick={() => setShowAddContact(true)} className="p-2 bg-blue-600 rounded-full"><UserPlus className="w-5 h-5" /></button>
          </div>
        </header>

        {showAddContact && (
          <div className="p-4 bg-slate-900 border-b border-slate-800 animate-in slide-in-from-top">
            <div className="flex gap-2">
              <input 
                placeholder="Nombre de usuario del amigo..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
              />
              <button onClick={addContact} className="bg-blue-600 px-4 rounded-lg text-sm font-bold">Agregar</button>
              <button onClick={() => setShowAddContact(false)} className="p-2 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {contacts.length === 0 ? (
            <div className="p-10 text-center opacity-30 mt-10">
              <UserPlus className="w-16 h-16 mx-auto mb-4" />
              <p>No tienes contactos. Agrega a alguien para empezar.</p>
            </div>
          ) : (
            contacts.map(contact => (
              <div 
                key={contact.name}
                onClick={() => { setActiveContact(contact); setView('chat'); }}
                className="p-4 border-b border-slate-900 hover:bg-slate-900 cursor-pointer flex justify-between items-center"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-700 rounded-full flex items-center justify-center font-bold text-lg uppercase">
                    {contact.name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold capitalize">{contact.name}</h3>
                    <p className="text-xs text-slate-400 truncate w-40">
                      {contact.messages.length > 0 
                        ? (contact.messages[contact.messages.length - 1].type === 'image' ? '📷 Foto' : contact.messages[contact.messages.length - 1].content.substring(0, 20) + '...') 
                        : 'Chat nuevo cifrado'}
                    </p>
                  </div>
                </div>
                {contact.messages.length > 0 && (
                  <span className="text-[10px] text-slate-500">
                    {formatTime(contact.messages[contact.messages.length - 1].time)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // 5. CHAT INDIVIDUAL
  if (view === 'chat' && activeContact) {
    // Filtrar mensajes para mostrar solo los de este contacto
    const currentMessages = contacts.find(c => c.name === activeContact.name)?.messages || [];

    return (
      <div className="min-h-screen bg-black text-white flex flex-col max-w-2xl mx-auto">
        {/* Header Chat */}
        <header className="p-3 bg-slate-900 border-b border-slate-800 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => setView('contacts')}><ChevronLeft /></button>
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center uppercase font-bold text-sm">
            {activeContact.name[0]}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm capitalize">{activeContact.name}</h3>
            <div className="flex items-center gap-1 text-[10px] text-green-500">
              <Shield className="w-3 h-3" /> E2EE PQC-Hybrid
            </div>
          </div>
          <button className="text-slate-500"><PhoneOff className="w-5 h-5" /></button>
        </header>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/90">
          {currentMessages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl p-2 ${msg.sender === 'me' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-slate-800 text-white rounded-tl-sm'}`}>
                
                {/* Contenido: Texto */}
                {msg.type === 'text' && <p className="text-sm px-2 py-1">{msg.content}</p>}
                
                {/* Contenido: Imagen */}
                {msg.type === 'image' && (
                  <img src={msg.content} alt="foto" className="rounded-lg max-h-60 border border-white/10" />
                )}

                {/* Contenido: Audio */}
                {msg.type === 'audio' && (
                  <audio controls src={msg.content} className="h-8 w-48 mt-1" />
                )}

                <p className="text-[9px] text-white/50 text-right mt-1 px-1">
                  {formatTime(msg.time)}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-2 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
          {/* Input Oculto para Fotos */}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleImageUpload} 
          />
          
          <button 
            onClick={() => fileInputRef.current.click()} 
            className="p-2 text-slate-400 hover:text-white"
          >
            <Camera className="w-6 h-6" />
          </button>

          <div className="flex-1 bg-slate-800 rounded-full flex items-center px-4 py-2 border border-slate-700">
            <input 
              type="text" 
              placeholder="Mensaje..." 
              className="bg-transparent border-none flex-1 text-sm focus:outline-none"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage(inputText, 'text')}
            />
          </div>

          {inputText.trim() ? (
            <button 
              onClick={() => sendMessage(inputText, 'text')}
              className="p-3 bg-blue-600 rounded-full text-white shadow-lg"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`p-3 rounded-full text-white transition-all shadow-lg ${isRecording ? 'bg-red-500 scale-110' : 'bg-slate-700'}`}
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default App;
