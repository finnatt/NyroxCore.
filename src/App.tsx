import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Code, 
  Settings as SettingsIcon, 
  Plus, 
  Send, 
  Cpu, 
  History,
  ChevronRight,
  ChevronLeft,
  Terminal,
  Database,
  Key,
  MoreVertical,
  Trash2,
  Sparkles,
  Minus,
  Square,
  X,
  LogIn,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Message, Chat, Settings } from './types';

const API_BASE = 'https://nyroxcore.de';

// Window Controls Component for Electron
const WindowControls = () => {
  const isElectron = (window as any).electronAPI?.isElectron;
  if (!isElectron) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1.5 bg-[#0a0a0a]/95 border border-white/10 rounded-full p-1.5 shadow-2xl backdrop-blur-md no-drag">
      <button 
        onClick={() => (window as any).electronAPI.minimize()}
        className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-all"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button 
        onClick={() => (window as any).electronAPI.maximize()}
        className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-all"
      >
        <Square className="w-3 h-3" />
      </button>
      <button 
        onClick={() => (window as any).electronAPI.close()}
        className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-red-500/80 hover:text-white transition-all"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default function App() {
  const [mode, setMode] = useState<'chat' | 'ide'>('chat');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [provider, setProvider] = useState<'openai' | 'gemini'>('gemini');
  const [settings, setSettings] = useState<Settings>({});
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [projectFiles, setProjectFiles] = useState<{ name: string; isDirectory: boolean }[]>([]);
  const [currentFileContent, setCurrentFileContent] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [authEmail, setAuthEmail] = useState('melvin.attermeier@icloud.com');
  const [authPassword, setAuthPassword] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authStep, setAuthStep] = useState<'email' | 'code'>('email');
  const [selectedModel, setSelectedModel] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (mode === 'ide' && terminalRef.current && !xtermRef.current) {
      const term = new XTerm({
        theme: {
          background: '#0a0a0a',
          foreground: '#10b981',
          cursor: '#10b981',
          selectionBackground: 'rgba(16, 185, 129, 0.3)',
        },
        fontSize: 12,
        fontFamily: 'JetBrains Mono, monospace',
        cursorBlink: true,
        allowProposedApi: true
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      term.writeln('\x1b[1;32mNyroxCore Sandbox Terminal v1.0.0\x1b[0m');
      term.writeln('Status: \x1b[1;34mBereit für Anweisungen...\x1b[0m');
      term.write('\n\x1b[1;32mnyrox@core:~\x1b[0m$ ');
      xtermRef.current = term;

      const handleResize = () => fitAddon.fit();
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        term.dispose();
        xtermRef.current = null;
      };
    }
  }, [mode]);

  useEffect(() => {
    const savedAuth = localStorage.getItem('nyrox_auth');
    if (savedAuth) {
      const { email, isOwner } = JSON.parse(savedAuth);
      setAuthEmail(email);
      setIsOwner(isOwner);
      setIsAuthenticated(true);
    }
    fetchSettings();
    fetchChats();
  }, []);

  const handleRequestCode = async () => {
    if (!authEmail || !authPassword) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthStep('code');
      } else {
        alert(data.error || 'Fehler beim Senden des Codes');
      }
    } catch (error) {
      alert('Fehler beim Senden des Codes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!authCode) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, code: authCode }),
      });
      const data = await res.json();
      if (data.success) {
        setIsOwner(data.isOwner);
        setIsAuthenticated(true);
        localStorage.setItem('nyrox_auth', JSON.stringify({ email: authEmail, isOwner: data.isOwner }));
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('Verifizierung fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentChatId) {
      fetchMessages(currentChatId);
      const chat = chats.find(c => c.id === currentChatId);
      if (chat) {
        setMode(chat.mode);
        if (chat.project_name) fetchProjectFiles(chat.project_name);
      }
    } else {
      setMessages([]);
      setProjectFiles([]);
      setCurrentFileContent(null);
    }
  }, [currentChatId, chats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchProjectFiles = async (projectName: string) => {
    const res = await fetch(`${API_BASE}/api/projects/${projectName}/files`);
    const data = await res.json();
    setProjectFiles(data);
  };

  const fetchFileContent = async (projectName: string, fileName: string) => {
    const res = await fetch(`${API_BASE}/api/projects/${projectName}/files/${fileName}`);
    const data = await res.json();
    setCurrentFileContent(data.content);
    setCurrentFileName(fileName);
  };

  const fetchSettings = async () => {
    const res = await fetch(`${API_BASE}/api/settings`);
    const data = await res.json();
    setSettings(data);
    if (data.last_provider) setProvider(data.last_provider);
  };

  const fetchChats = async () => {
    const res = await fetch(`${API_BASE}/api/chats`);
    const data = await res.json();
    setChats(data);
  };

  const fetchMessages = async (chatId: string) => {
    const res = await fetch(`${API_BASE}/api/chats/${chatId}/messages`);
    const data = await res.json();
    setMessages(data);
  };

  const saveSettings = async (newSettings: Partial<Settings>) => {
    await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings),
    });
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setModelUsed(null);

    let chatId = currentChatId;
    let projectName = chats.find(c => c.id === chatId)?.project_name;

    if (!chatId) {
      chatId = crypto.randomUUID();
      const title = input.slice(0, 30) + (input.length > 30 ? '...' : '');
      projectName = mode === 'ide' ? `Project_${chatId.slice(0, 8)}` : undefined;
      
      await fetch(`${API_BASE}/api/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: chatId, 
          title, 
          model_provider: provider,
          mode: mode,
          project_name: projectName
        }),
      });
      setCurrentChatId(chatId);
      fetchChats();
    }

    await fetch(`${API_BASE}/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userMessage),
    });

    try {
      const res = await fetch(`${API_BASE}/api/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          messages: newMessages,
          mode: mode,
          chatId: chatId,
          model: selectedModel || undefined
        }),
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      setModelUsed(data.modelUsed);
      const assistantMessage: Message = { role: 'assistant', content: data.content };
      setMessages(prev => [...prev, assistantMessage]);

      await fetch(`${API_BASE}/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assistantMessage),
      });

      if (mode === 'ide' && projectName) {
        fetchProjectFiles(projectName);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
        <WindowControls />
        
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#171717] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative z-10"
        >
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-black border border-emerald-500/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)] overflow-hidden">
              <img src="/icon.png" alt="Nyrox" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">NyroxCore</h1>
            <p className="text-gray-500 text-sm mt-2">Enterprise Intelligence & Sandbox IDE</p>
          </div>

          {/* Auth Mode Switcher */}
          <div className="flex bg-black/20 p-1.5 rounded-2xl border border-white/5 mb-8">
            <button 
              onClick={() => setAuthMode('register')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${authMode === 'register' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              REGISTRIEREN
            </button>
            <button 
              onClick={() => setAuthMode('login')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${authMode === 'login' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <LogIn className="w-3.5 h-3.5" />
              ANMELDEN
            </button>
          </div>

          <AnimatePresence mode="wait">
            {authStep === 'email' ? (
              <motion.div 
                key="email"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Entwickler E-Mail</label>
                  <input 
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Passwort</label>
                  <input 
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>
                <button 
                  onClick={handleRequestCode}
                  disabled={isLoading || !authEmail || !authPassword}
                  className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-emerald-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : (authMode === 'register' ? 'Verifizierungscode anfordern' : 'Anmelden')}
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="code"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">6-stelliger Code</label>
                  <input 
                    type="text"
                    maxLength={6}
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    placeholder="000000"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>
                <button 
                  onClick={handleVerifyCode}
                  disabled={isLoading || authCode.length < 6}
                  className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : 'Identität bestätigen'}
                </button>
                <button 
                  onClick={() => setAuthStep('email')}
                  className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  E-Mail ändern
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-[10px] text-center text-gray-600 mt-8">
            Durch die Anmeldung akzeptieren Sie die Sicherheitsrichtlinien von NyroxCore.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0e0e0e] text-gray-200 font-sans overflow-hidden relative">
      <WindowControls />
      
      {/* Drag Area for Electron */}
      <div className="fixed top-0 left-0 right-0 h-8 z-[90] drag-area pointer-events-none" />

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: sidebarOpen ? 280 : 0,
          x: mobileMenuOpen ? 0 : (window.innerWidth < 768 ? -280 : 0)
        }}
        className={`bg-[#171717] border-r border-white/5 flex flex-col fixed md:relative h-full z-50 transition-all duration-300 ${!sidebarOpen && 'md:border-none'}`}
      >
        <div className="p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 font-semibold text-white">
            <div className="w-8 h-8 rounded-full bg-black border border-emerald-500/30 flex items-center justify-center overflow-hidden shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              <img 
                src="/icon.png" 
                alt="NC" 
                className="w-full h-full object-cover"
              />
            </div>
            <span className="tracking-tight">NyroxCore</span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={startNewChat}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              title="Neuer Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 hover:bg-white/5 rounded-lg md:hidden"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Provider Selection */}
        <div className="px-4 mb-4">
          <div className="bg-black/20 p-1 rounded-xl flex gap-1 border border-white/5">
            <button 
              onClick={() => { setProvider('gemini'); setSelectedModel(''); saveSettings({ last_provider: 'gemini' }); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${provider === 'gemini' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Gemini
            </button>
            <button 
              onClick={() => { setProvider('openai'); setSelectedModel(''); saveSettings({ last_provider: 'openai' }); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${provider === 'openai' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              OpenAI
            </button>
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
          <div className="px-2 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Verlauf</div>
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => setCurrentChatId(chat.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3 group ${currentChatId === chat.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
            >
              <MessageSquare className="w-4 h-4 opacity-50" />
              <span className="truncate flex-1">{chat.title}</span>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-white/5 space-y-2">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-all"
          >
            <SettingsIcon className="w-4 h-4" />
            <span>Einstellungen</span>
          </button>
          <div className="flex items-center gap-3 px-3 py-2 text-[10px] text-gray-600">
            <Database className="w-3 h-3" />
            <span>Lokaler Speicher aktiv</span>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 bg-[#0e0e0e]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 hover:bg-white/5 rounded-lg md:hidden text-gray-400"
            >
              <Terminal className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hidden md:block"
            >
              {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
            <h2 className="text-sm font-medium text-gray-300 truncate max-w-[150px] sm:max-w-none">
              {currentChatId ? chats.find(c => c.id === currentChatId)?.title : 'Neue Sitzung'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
             {isLoading && (
               <div className="flex items-center gap-2 px-2 sm:px-3 py-1 bg-blue-500/10 rounded-full text-[9px] sm:text-[10px] font-mono text-blue-400 border border-blue-500/20 animate-pulse">
                 <Sparkles className="w-3 h-3" />
                 <span className="hidden xs:inline">NYROX DENKT...</span>
               </div>
             )}
             {modelUsed && (
               <div className="px-2 sm:px-3 py-1 bg-white/5 rounded-full text-[9px] sm:text-[10px] font-mono text-gray-500 border border-white/10 hidden sm:block">
                 {modelUsed.toUpperCase()}
               </div>
             )}
             <div className="px-2 sm:px-3 py-1 bg-white/5 rounded-full text-[9px] sm:text-[10px] font-mono text-emerald-500 border border-emerald-500/20">
               {provider.toUpperCase()}
             </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {mode === 'chat' ? (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full flex flex-col"
              >
                <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-40 py-12">
                      <div className="relative">
                        <div className="w-32 h-32 sm:w-48 sm:h-48 bg-black rounded-full flex items-center justify-center border border-emerald-500/30 shadow-[0_0_80px_rgba(16,185,129,0.25)] overflow-hidden">
                          <img 
                            src="https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/www/public/og.png" 
                            alt="NyroxCore Logo" 
                            className="w-full h-full object-cover rounded-full scale-105"
                            referrerPolicy="no-referrer"
                            style={{ mixBlendMode: 'lighten' }}
                          />
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 sm:w-12 sm:h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-2xl border border-white/10">
                          <Cpu className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                      </div>
                      <div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">NyroxCore Intelligenz</h1>
                        <p className="text-xs sm:text-base max-w-xs mx-auto mt-3 text-gray-400">Dein hochmoderner KI-Assistent für Chat und Entwicklung.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mt-8 w-full px-4">
                        {['Quantencomputer erklären', 'Python Skript schreiben', 'Text zusammenfassen', 'Kreatives Schreiben'].map(suggestion => (
                          <button 
                            key={suggestion}
                            onClick={() => setInput(suggestion)}
                            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs hover:bg-white/10 transition-all text-left sm:text-center"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full max-w-3xl mx-auto`}>
                      {msg.role === 'user' ? (
                        <div className="bg-[#2b2b2b] text-gray-200 rounded-2xl px-4 sm:px-5 py-2.5 text-sm leading-relaxed max-w-[90%] sm:max-w-[85%] shadow-sm border border-white/5">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="flex gap-3 sm:gap-5 w-full mt-2">
                          <div className="mt-1 flex-shrink-0">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-transparent flex items-center justify-center">
                              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                            </div>
                          </div>
                          <div className="flex-1 text-gray-200 text-sm sm:text-[15px] leading-relaxed pt-1.5 markdown-body overflow-hidden">
                            <Markdown>{msg.content}</Markdown>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3 sm:gap-5 w-full max-w-3xl mx-auto mt-2">
                      <div className="mt-1 flex-shrink-0">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-transparent flex items-center justify-center">
                          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400/50 animate-pulse" />
                        </div>
                      </div>
                      <div className="flex-1 flex gap-1.5 pt-4">
                        <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-white/5 bg-[#0e0e0e]">
                  <div className="max-w-3xl mx-auto relative flex items-end gap-2 bg-[#171717] rounded-2xl border border-white/10 p-2 focus-within:border-emerald-500/30 transition-all shadow-xl">
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="bg-white/5 border-none text-[10px] text-gray-400 rounded-lg px-2 py-2 focus:ring-0 cursor-pointer hover:bg-white/10 transition-colors mb-0.5 ml-1"
                    >
                      <option value="" className="bg-[#171717]">Auto</option>
                      {provider === 'openai' ? (
                        <>
                          <option value="gpt-4o" className="bg-[#171717]">GPT-4o</option>
                          <option value="gpt-4o-mini" className="bg-[#171717]">GPT-4o Mini</option>
                        </>
                      ) : (
                        <>
                          <option value="gemini-3.1-pro-preview" className="bg-[#171717]">Gemini 3.1 Pro</option>
                          <option value="gemini-3-flash-preview" className="bg-[#171717]">Gemini 3 Flash</option>
                        </>
                      )}
                    </select>
                    <textarea 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Frag NyroxCore..."
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-3 resize-none max-h-48 custom-scrollbar min-h-[40px]"
                      rows={1}
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={!input.trim() || isLoading}
                      className="p-2.5 bg-white text-black rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-lg"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[10px] text-center text-gray-600 mt-2">NyroxCore kann Fehler machen. Überprüfe wichtige Informationen.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="ide"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-full flex flex-col md:flex-row p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden"
              >
                {/* File Explorer */}
                <div className="w-full md:w-56 bg-[#171717] rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-xl shrink-0 h-48 md:h-full">
                  <div className="p-3 sm:p-4 border-b border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Projekt Dateien</span>
                    <Terminal className="w-3 h-3 text-gray-600" />
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {projectFiles.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-20">
                        <Code className="w-6 h-6 mb-2" />
                        <p className="text-[9px]">Keine Dateien</p>
                      </div>
                    ) : (
                      projectFiles.map(file => (
                        <button
                          key={file.name}
                          onClick={() => {
                            const chat = chats.find(c => c.id === currentChatId);
                            if (chat?.project_name) fetchFileContent(chat.project_name, file.name);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-[11px] transition-all flex items-center gap-2 ${currentFileName === file.name ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                        >
                          <Code className="w-3 h-3" />
                          <span className="truncate">{file.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Editor View */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                  <div className="flex-1 bg-[#1a1a1a] rounded-2xl border border-white/10 overflow-hidden flex flex-col shadow-2xl">
                    <div className="h-10 border-b border-white/5 flex items-center px-4 gap-4 bg-black/20">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
                      </div>
                      <div className="text-[10px] font-mono text-gray-500 flex items-center gap-2 truncate">
                        <Terminal className="w-3 h-3" />
                        {currentFileName || 'Keine Datei ausgewählt'}
                      </div>
                    </div>
                    <div className="flex-1 p-4 sm:p-6 font-mono text-xs sm:text-sm text-emerald-500/80 overflow-auto custom-scrollbar bg-[#0a0a0a]">
                      {currentFileContent ? (
                        <pre className="whitespace-pre-wrap">
                          {currentFileContent}
                        </pre>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600">
                          <Code className="w-12 h-12 mb-4 opacity-20" />
                          <p className="text-xs">Wähle eine Datei aus</p>
                          <p className="text-[10px] mt-2 opacity-50">Oder gib Anweisungen im rechten Fenster</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Terminal View */}
                  <div className="h-40 bg-[#0a0a0a] rounded-2xl border border-white/10 overflow-hidden shadow-xl p-2">
                    <div ref={terminalRef} className="h-full w-full" />
                  </div>
                </div>

                {/* IDE Chat Sidebar */}
                <div className="w-full md:w-80 bg-[#171717] rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-xl shrink-0 h-64 md:h-full">
                  <div className="p-3 sm:p-4 border-b border-white/5 flex items-center justify-between bg-black/10">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">KI Anweisungen</span>
                    <Sparkles className="w-3 h-3 text-blue-400" />
                  </div>
                  
                  {/* Chat History in IDE */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                        <MessageSquare className="w-8 h-8 mb-2" />
                        <p className="text-[10px]">Beschreibe dein Projekt</p>
                      </div>
                    ) : (
                      messages.map((msg, i) => (
                        <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className={`rounded-xl px-3 py-2 text-[11px] leading-relaxed max-w-[90%] ${
                            msg.role === 'user' 
                              ? 'bg-[#2b2b2b] text-gray-200 border border-white/5' 
                              : 'text-gray-300 pt-1'
                          }`}>
                            {msg.role === 'assistant' ? (
                              <div className="markdown-body text-[11px]">
                                <Markdown>{msg.content}</Markdown>
                              </div>
                            ) : msg.content}
                          </div>
                        </div>
                      ))
                    )}
                    {isLoading && (
                      <div className="flex gap-2 items-center text-[10px] text-gray-500 animate-pulse">
                        <Sparkles className="w-3 h-3 text-blue-400" />
                        <span>Nyrox generiert...</span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* IDE Input Area */}
                  <div className="p-3 border-t border-white/5 bg-black/10">
                    <div className="flex flex-col gap-2">
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full bg-white/5 border border-white/5 text-[9px] text-gray-500 rounded-lg px-2 py-1 focus:ring-0 cursor-pointer hover:bg-white/10 transition-colors"
                      >
                        <option value="" className="bg-[#171717]">Auto-Modell (Empfohlen)</option>
                        {provider === 'openai' ? (
                          <>
                            <option value="gpt-4o" className="bg-[#171717]">GPT-4o (High)</option>
                            <option value="gpt-4o-mini" className="bg-[#171717]">GPT-4o Mini (Fast)</option>
                          </>
                        ) : (
                          <>
                            <option value="gemini-3.1-pro-preview" className="bg-[#171717]">Gemini 3.1 Pro (Coding)</option>
                            <option value="gemini-3-flash-preview" className="bg-[#171717]">Gemini 3 Flash (Fast)</option>
                          </>
                        )}
                      </select>
                      <div className="relative">
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="Anweisung geben..."
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-3 pr-10 text-[11px] focus:outline-none focus:border-emerald-500/50 transition-all resize-none min-h-[45px] max-h-[120px]"
                        rows={1}
                      />
                      <button 
                        onClick={handleSendMessage}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 bottom-2 p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-all"
                      >
                        <Send className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </main>

      {/* Mode Toggle (Desktop: Right Side Centered, Mobile: Bottom Bar) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 md:top-1/2 md:-translate-y-1/2 z-30">
        <div className="bg-[#0a0a0a]/95 border border-white/10 rounded-2xl md:rounded-full p-1.5 flex md:flex-col gap-1.5 shadow-2xl backdrop-blur-md">
          <button 
            onClick={() => setMode('chat')}
            className={`w-12 h-12 md:w-10 md:h-10 rounded-xl md:rounded-full flex items-center justify-center transition-all ${mode === 'chat' ? 'bg-white text-black shadow-lg scale-110 md:scale-105' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
            title="Chat-Modus"
          >
            <MessageSquare className="w-5 h-5 md:w-4 md:h-4" />
          </button>
          <button 
            onClick={() => setMode('ide')}
            className={`w-12 h-12 md:w-10 md:h-10 rounded-xl md:rounded-full flex items-center justify-center transition-all ${mode === 'ide' ? 'bg-white text-black shadow-lg scale-110 md:scale-105' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
            title="IDE-Modus"
          >
            <Code className="w-5 h-5 md:w-4 md:h-4" />
          </button>
        </div>
      </div>

      {/* Settings Modal Overlay */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#171717] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-emerald-500" />
                  API Konfiguration
                </h3>
                <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white transition-colors">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">OpenAI API Schlüssel</label>
                  <input 
                    type="password"
                    value={settings.openai_key || ''}
                    onChange={(e) => saveSettings({ openai_key: e.target.value })}
                    placeholder="sk-..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Gemini API Schlüssel</label>
                  <input 
                    type="password"
                    value={settings.gemini_key || ''}
                    onChange={(e) => saveSettings({ gemini_key: e.target.value })}
                    placeholder="AIza..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                  <p className="text-[10px] text-gray-600">Falls leer, wird der Standard-Key verwendet.</p>
                </div>
                <div className="pt-4">
                  {isOwner && (
                    <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                      <div className="flex items-center gap-2 text-emerald-500 font-bold text-[10px] uppercase tracking-widest mb-3">
                        <Terminal className="w-3 h-3" />
                        Besitzer-Tools aktiviert
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Chrome DevTools (F12)</span>
                        <div className="w-8 h-4 bg-emerald-600 rounded-full relative">
                          <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full" />
                        </div>
                      </div>
                    </div>
                  )}
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="w-full py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Fertig
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .markdown-body strong {
          font-weight: 700;
          color: #fff;
        }
        .markdown-body p {
          margin-bottom: 1rem;
        }
        .markdown-body p:last-child {
          margin-bottom: 0;
        }
        .markdown-body ul, .markdown-body ol {
          margin-bottom: 1rem;
          padding-left: 1.5rem;
        }
        .markdown-body li {
          margin-bottom: 0.5rem;
        }
        .drag-area {
          -webkit-app-region: drag;
        }
        .no-drag {
          -webkit-app-region: no-drag;
        }
      `}</style>
    </div>
  );
}
