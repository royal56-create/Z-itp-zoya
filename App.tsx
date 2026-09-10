import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Mic, MicOff, Loader2, Volume2, VolumeX, Send, History, 
  Monitor, PhoneCall, ExternalLink, X, User, MessageSquare, Smartphone, Award
} from "lucide-react";
import { getRoyalResponse, getRoyalAudio, resetRoyalSession } from "./geminiService";
import { processCommand } from "./commandService";
import { LiveSessionManager } from "./liveService";
import { openAppOrWeb } from "./appLauncher";
import Visualizer from "./Visualizer";
import PermissionModal from "./PermissionModal";
import DeviceInfoModal from "./DeviceInfoModal";
import PortfolioEmbed from "./PortfolioEmbed";
import UserSettingsModal from "./UserSettingsModal";
import VoiceHistoryModal from "./VoiceHistoryModal";
import LoginView from "./LoginView";
import ZoyaLogo from "./ZoyaLogo";
import { playPCM } from "./audioUtils";
import { motion, AnimatePresence } from "motion/react";
import { 
  getDeviceInfo, loadChatHistory, saveChatHistory, clearChatHistory, 
  ChatMessage, DeviceInfo 
} from "./deviceManager";
import { 
  getPersistedUser, 
  subscribeAuthStatus, 
  AppUserProfile, 
  saveMessageToFirestore,
  subscribeUserChatHistory,
  clearUserChatHistoryInFirestore,
  VoiceTopicSession,
  subscribeUserTopics,
  clearUserTopicsInFirestore,
  deleteSingleTopic,
  addMessageToTopic
} from "./firebaseService";
import { 
  startTelegramCommandListener, 
  stopTelegramCommandListener 
} from "./developerDispatchService";

type AppState = "idle" | "listening" | "processing" | "speaking";

export default function App() {
  // Authentication & Persistent User Profile
  const [user, setUser] = useState<AppUserProfile | null>(() => getPersistedUser());
  const [showUserSettingsModal, setShowUserSettingsModal] = useState(false);
  const [showVoiceHistoryModal, setShowVoiceHistoryModal] = useState(false);
  const [topics, setTopics] = useState<VoiceTopicSession[]>([]);
  const currentVoiceTopicIdRef = useRef<string | null>(null);
  const currentTextTopicIdRef = useRef<string | null>(null);
  const lastTextTimeRef = useRef<number>(0);

  // Sync auth state listener
  useEffect(() => {
    const unsubscribe = subscribeAuthStatus((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Background Telegram Command Listener for Developer Stats & Inquiries
  useEffect(() => {
    startTelegramCommandListener(8000);
    return () => {
      stopTelegramCommandListener();
    };
  }, []);

  const [appState, setAppState] = useState<AppState>("idle");
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => getDeviceInfo());
  
  // Chat messages tied to active user (or device fallback)
  const activeUserId = user ? user.uid : deviceInfo.userId;
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatHistory(activeUserId));
  const messagesRef = useRef(messages);

  // Sync messages with local storage
  useEffect(() => {
    messagesRef.current = messages;
    if (activeUserId) {
      saveChatHistory(messages, activeUserId);
    }
  }, [messages, activeUserId]);

  // Load and subscribe to real-time chat history from Firestore if user is logged in
  useEffect(() => {
    if (user?.uid) {
      // 1. Immediately load local cache for this specific user
      const local = loadChatHistory(user.uid);
      if (local && local.length > 0) {
        setMessages(local);
      }
      
      // 2. Subscribe to Firestore updates
      const unsubscribe = subscribeUserChatHistory(user.uid, (firestoreMsgs) => {
        if (firestoreMsgs && firestoreMsgs.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map(m => m.id));
            const newItems = firestoreMsgs.filter(m => !existingIds.has(m.id));
            if (newItems.length > 0 || prev.length === 0) {
              const all = [...prev, ...newItems].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
              return all;
            }
            return prev;
          });
        }
      });
      return () => unsubscribe();
    }
  }, [user?.uid]);

  // Load and subscribe to real-time conversation topics from Firestore/local if user is logged in
  useEffect(() => {
    if (user?.uid) {
      const unsubscribe = subscribeUserTopics(user.uid, (userTopics) => {
        if (userTopics) {
          setTopics(userTopics);
        }
      });
      return () => unsubscribe();
    } else {
      setTopics([]);
    }
  }, [user?.uid]);

  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);

  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    if (liveSessionRef.current) {
      liveSessionRef.current.setMuted(newMuteState);
    }
  };

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.setMuted(isMuted);
    }
  }, [isMuted]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenErrorMsg, setScreenErrorMsg] = useState<string | null>(null);
  const [liveCaption, setLiveCaption] = useState<{ sender: "user" | "Royal"; text: string } | null>(null);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const createMessage = (sender: "user" | "Royal", text: string): ChatMessage => {
    const msg: ChatMessage = {
      id: Date.now().toString() + "-" + Math.random().toString(36).substr(2, 5),
      sender,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      userId: activeUserId,
      createdAt: Date.now()
    };
    if (user?.uid) {
      saveMessageToFirestore(user.uid, msg);
    }
    return msg;
  };

  const handleTextCommand = useCallback(async (finalTranscript: string) => {
    if (!user || !user.uid) {
      setAppState("idle");
      return;
    }

    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    const userMsg = createMessage("user", finalTranscript);
    setMessages((prev) => [...prev, userMsg]);
    
    // Maintain active text topic session (reset after 30 min of inactivity)
    if (!currentTextTopicIdRef.current || Date.now() - lastTextTimeRef.current > 30 * 60 * 1000) {
      currentTextTopicIdRef.current = "topic_text_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    }
    lastTextTimeRef.current = Date.now();
    const activeTextTopicId = currentTextTopicIdRef.current;

    if (user?.uid) {
      addMessageToTopic(user.uid, activeTextTopicId, {
        sender: "user",
        text: finalTranscript,
        mode: "text",
      }).catch((err) => console.warn("Failed to record text message to topic:", err));
    }
    
    // If live session is active, send text through it
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    setAppState("processing");

    // 1. Check for commands (app opening, calls, quiz, telegram dispatch, hacking refusal, etc.)
    const commandResult = processCommand(finalTranscript);

    let responseText = "";

    if (commandResult.action) {
      responseText = commandResult.action;
      const aiMsg = createMessage("Royal", responseText);
      setMessages((prev) => [...prev, aiMsg]);
      
      if (user?.uid && responseText.trim()) {
        addMessageToTopic(user.uid, activeTextTopicId, {
          sender: "Royal",
          text: responseText,
          mode: "text",
        }).catch((err) => console.warn("Failed to record command response to topic:", err));
      }
      
      if (!isSpeakerMuted) {
        setAppState("speaking");
        const audioBase64 = await getRoyalAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }

      setAppState("idle");

      if (commandResult.isBrowserAction) {
        setTimeout(() => {
          if (commandResult.appLaunchConfig) {
            openAppOrWeb(commandResult.appLaunchConfig);
          } else if (commandResult.url) {
            window.open(commandResult.url, "_blank");
          }
        }, 1200);
      }
    } else {
      // 2. General Chit-Chat via Gemini
      responseText = await getRoyalResponse(finalTranscript, messagesRef.current);
      const aiMsg = createMessage("Royal", responseText);
      setMessages((prev) => [...prev, aiMsg]);
      
      if (user?.uid && responseText.trim()) {
        addMessageToTopic(user.uid, activeTextTopicId, {
          sender: "Royal",
          text: responseText,
          mode: "text",
        }).catch((err) => console.warn("Failed to record AI response to topic:", err));
      }
      
      if (!isSpeakerMuted) {
        setAppState("speaking");
        const audioBase64 = await getRoyalAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }
      setAppState("idle");
    }
  }, [isSpeakerMuted, isSessionActive, activeUserId, user?.uid]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  const startLiveSession = async (withScreenShare = false) => {
    if (!user || !user.uid) {
      return;
    }
    try {
      setIsSessionActive(true);
      resetRoyalSession();
      
      // Initialize a new voice session topic
      const newVoiceTopicId = "topic_voice_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
      currentVoiceTopicIdRef.current = newVoiceTopicId;

      const session = new LiveSessionManager();
      session.setMuted(isMuted);
      liveSessionRef.current = session;
      
      session.onStateChange = (state) => {
        setAppState(state);
      };

      session.onScreenShareChange = (active) => {
        setIsScreenSharing(active);
      };

      session.onLiveCaption = (sender, text) => {
        if (text && text.trim()) {
          setLiveCaption({ sender, text: text.trim() });
        }
      };
      
      session.onMessage = (sender, text) => {
        const msg = createMessage(sender, text);
        setMessages((prev) => [...prev, msg]);
        if (text && text.trim()) {
          setLiveCaption({ sender, text: text.trim() });
        }
        if (user?.uid && text.trim()) {
          const topicId = currentVoiceTopicIdRef.current || ("topic_voice_" + Date.now());
          currentVoiceTopicIdRef.current = topicId;
          addMessageToTopic(user.uid, topicId, {
            sender: sender === "user" ? "user" : "Royal",
            text: text.trim(),
            mode: "voice",
          }).catch((err) => console.warn("Failed to record voice message to topic:", err));
        }
      };
      
      session.onCommand = (launchTarget) => {
        setTimeout(() => {
          if (typeof launchTarget === "string") {
            window.open(launchTarget, "_blank");
          } else {
            openAppOrWeb(launchTarget);
          }
        }, 1000);
      };

      session.onError = (err) => {
        console.error("Live Session error caught:", err);
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setIsScreenSharing(false);
        setAppState("idle");
      };

      await session.start();

      if (withScreenShare) {
        setTimeout(async () => {
          if (liveSessionRef.current) {
            try {
              await liveSessionRef.current.startScreenShare();
            } catch (e: any) {
              console.error("Screen share start failed:", e);
              const msg = e?.message || "Screen share is not supported or was denied in this browser context.";
              setScreenErrorMsg(msg);
            }
          }
        }, 800);
      }
    } catch (e) {
      console.error("Failed to start session", e);
      setShowPermissionModal(true);
      setIsSessionActive(false);
      setIsScreenSharing(false);
      setAppState("idle");
    }
  };

  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      setIsScreenSharing(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      currentVoiceTopicIdRef.current = null;
      setAppState("idle");
      resetRoyalSession();
    } else {
      await startLiveSession(false);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    
    handleTextCommand(textInput);
    setTextInput("");
    setShowTextInput(false);
  };

  const handleClearHistory = async () => {
    clearChatHistory(activeUserId);
    if (user?.uid) {
      await clearUserChatHistoryInFirestore(user.uid);
    }
    setMessages([]);
    resetRoyalSession();
  };

  const getUserInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  // IF NO USER IS LOGGED IN: Render the Exact 360° Neon Glow Login View
  if (!user) {
    return (
      <div className="fixed inset-0 w-screen h-[100dvh] overflow-hidden bg-[#050505]">
        <LoginView
          onLoginSuccess={(loggedInUser) => {
            setUser(loggedInUser);
          }}
          onOpenPortfolio={() => setShowPortfolioModal(true)}
        />
        <PortfolioEmbed
          isOpen={showPortfolioModal}
          onClose={() => setShowPortfolioModal(false)}
        />
      </div>
    );
  }

  // Active Authenticated App View
  return (
    <div className="fixed inset-0 w-screen h-[100dvh] overflow-hidden bg-[#050505] text-white flex flex-col items-center justify-between font-sans relative m-0 p-0 select-none">
      {showPermissionModal && (
        <PermissionModal 
          onClose={() => setShowPermissionModal(false)} 
          onSwitchToText={() => {
            setShowPermissionModal(false);
            setShowTextInput(true);
          }}
          onRetryVoice={() => {
            startLiveSession(false);
          }}
        />
      )}

      {/* User Settings & Profile Modal */}
      {user && (
        <UserSettingsModal
          isOpen={showUserSettingsModal}
          onClose={() => setShowUserSettingsModal(false)}
          user={user}
          voiceCount={topics.length}
          onLogout={() => {
            setUser(null);
          }}
          onOpenPortfolio={() => {
            setShowUserSettingsModal(false);
            setShowPortfolioModal(true);
          }}
          onOpenVoiceHistory={() => {
            setShowUserSettingsModal(false);
            setShowVoiceHistoryModal(true);
          }}
        />
      )}

      {/* User Voice History Modal */}
      {user && (
        <VoiceHistoryModal
          isOpen={showVoiceHistoryModal}
          onClose={() => setShowVoiceHistoryModal(false)}
          topics={topics}
          user={user}
          onClearTopics={async () => {
            if (user?.uid) {
              await clearUserTopicsInFirestore(user.uid);
            }
            setTopics([]);
          }}
          onDeleteTopic={async (topicId: string) => {
            if (user?.uid) {
              await deleteSingleTopic(user.uid, topicId);
            }
            setTopics((prev) => prev.filter((t) => t.id !== topicId));
          }}
          onStartVoiceCall={() => {
            setShowVoiceHistoryModal(false);
            if (!isSessionActive) {
              startLiveSession(false);
            }
          }}
        />
      )}

      {/* Device Info Modal */}
      <DeviceInfoModal
        isOpen={showDeviceModal}
        onClose={() => setShowDeviceModal(false)}
        deviceInfo={deviceInfo}
        voiceCount={topics.length}
        onClearData={handleClearHistory}
        onOpenPortfolio={() => setShowPortfolioModal(true)}
      />

      {/* Creator Portfolio Modal */}
      <PortfolioEmbed
        isOpen={showPortfolioModal}
        onClose={() => setShowPortfolioModal(false)}
      />

      {/* Cinematic Background Gradients - Full Bleed */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-violet-900/20 blur-[130px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-pink-900/20 blur-[130px] rounded-full" />
      </div>

      {/* Header - Full Width with Safe Area */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-3 sm:px-6 md:px-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        {/* Brand identity */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button 
            onClick={() => setShowPortfolioModal(true)} 
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full relative overflow-hidden flex items-center justify-center shadow-lg shadow-red-500/30 ring-1 ring-red-500/60 hover:scale-105 transition-transform shrink-0 cursor-pointer group"
            title="Open Royal Ankit Ahiran Portfolio"
          >
            <ZoyaLogo size={40} showGlow={false} className="w-full h-full" />
          </button>
          <div className="text-left">
            <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-wider bg-gradient-to-r from-white via-violet-200 to-pink-200 bg-clip-text text-transparent truncate max-w-[170px] sm:max-w-none">
              ZOYA AI VOICE ASSISTANT
            </h1>
            <button 
              onClick={() => setShowPortfolioModal(true)}
              className="text-[9px] sm:text-[10px] font-mono tracking-widest text-red-300 hover:text-red-200 hover:underline uppercase transition-colors flex items-center gap-1 text-left cursor-pointer"
              title="Click to view Royal Ankit Ahiran portfolio"
            >
              <span>By Royal Ankit Ahiran</span>
              <Award size={10} className="text-red-400 opacity-90 shrink-0" />
            </button>
          </div>
        </div>

        {/* Header Actions - Clean, Integrated Profile & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Developer Portfolio Link */}
          <button
            onClick={() => setShowPortfolioModal(true)}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border text-[11px] sm:text-xs font-medium transition-all shadow-sm bg-gradient-to-r from-red-600/30 to-pink-600/30 hover:from-red-600/50 hover:to-pink-600/50 border-red-500/40 text-red-200 cursor-pointer hover:scale-105"
            title="Open Portfolio (https://royalankitahiranl.netlify.app)"
          >
            <Award size={13} className="text-red-400 shrink-0" />
            <span className="hidden xs:inline">Portfolio</span>
          </button>

          {/* Speaker Mute Toggle */}
          <button
            onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
            className="p-1.5 sm:p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 shrink-0 cursor-pointer"
            title={isSpeakerMuted ? "Unmute Speaker" : "Mute Speaker"}
          >
            {isSpeakerMuted ? (
              <VolumeX size={16} className="opacity-70 text-red-400" />
            ) : (
              <Volume2 size={16} className="opacity-70" />
            )}
          </button>

          {/* User Account Button with Profile Photo / Initials */}
          <button
            onClick={() => setShowUserSettingsModal(true)}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/15 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95 shrink-0"
            title={`Logged in as ${user.displayName} - Click for settings & logout`}
          >
            <div className="relative">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-cyan-400"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-600 to-teal-500 flex items-center justify-center text-[10px] font-bold text-white ring-1 ring-cyan-400/50">
                  {getUserInitials(user.displayName)}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-black" />
            </div>
            <span className="text-xs font-semibold text-white/90 max-w-[80px] sm:max-w-[110px] truncate hidden sm:inline">
              {user.displayName.split(" ")[0]}
            </span>
          </button>
        </div>
      </header>

      {/* Screen Sharing Error Banner */}
      {screenErrorMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 z-40 max-w-lg mx-auto px-4 w-full pointer-events-auto"
        >
          <div className="bg-gradient-to-r from-pink-900/90 to-purple-900/90 border border-pink-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex items-start justify-between gap-3 text-white">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-pink-500/20 rounded-xl shrink-0 mt-0.5">
                <Monitor size={20} className="text-pink-300" />
              </div>
              <div className="text-xs space-y-1">
                <p className="font-semibold text-pink-200">Screen Vision Alert / स्क्रीन विज़न सूचना</p>
                <p className="text-white/80 leading-relaxed">{screenErrorMsg}</p>
                <div className="pt-1.5 flex flex-wrap gap-2">
                  <button
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 hover:bg-white/25 text-white rounded-lg font-medium text-[11px] transition-colors"
                  >
                    <span>Open in New Tab</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setScreenErrorMsg(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Main Content - Visualizer */}
      <main className="absolute inset-0 flex flex-col items-center justify-center w-full h-full z-10 overflow-hidden pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] pb-[max(6.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] px-3 sm:px-6 md:px-12 pointer-events-auto">
        <div className="relative w-full h-full flex flex-row items-center justify-between pointer-events-none">
          {/* Left Column: Royal Status */}
          <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
            <div className="h-6">
              <AnimatePresence>
                {appState === "processing" && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center gap-2 text-cyan-300/80 text-sm md:text-base italic font-serif"
                  >
                    <Loader2 size={16} className="animate-spin" />
                    Replying...
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Center Visualizer */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <Visualizer state={appState} />
          </div>

          {/* Right Column: User Status */}
          <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
            <div className="h-6 flex justify-end">
              <AnimatePresence>
                {appState === "listening" && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-2 text-violet-300/80 text-sm md:text-base italic"
                  >
                    {isMuted ? (
                      <div className="flex items-center gap-2 text-red-400 font-medium not-italic bg-red-500/10 border border-red-500/30 px-3 py-1 rounded-full text-xs md:text-sm">
                        <MicOff size={14} className="text-red-400" />
                        <span>Muted</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                        <span>Listening...</span>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Live Latest Transcript Preview Floating Bottom Banner */}
          {(() => {
            const activeCaption = liveCaption || (messages.length > 0 ? messages[messages.length - 1] : null);
            if (!activeCaption || !activeCaption.text) return null;
            const isUser = activeCaption.sender === "user";
            return (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 max-w-xl w-full px-4 z-20 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isUser ? "bg-cyan-400" : "bg-violet-400"
                      }`}
                    />
                    <span
                      className={`font-semibold shrink-0 ${
                        isUser ? "text-cyan-300" : "text-violet-300"
                      }`}
                    >
                      {isUser ? "You:" : "Zoya:"}
                    </span>
                    <p className="text-white/80 truncate">
                      {activeCaption.text}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </main>

      {/* Controls */}
      <footer className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))] px-3 sm:px-4 z-20 shrink-0 gap-2.5 sm:gap-3">
        {/* Status Pills */}
        {isSessionActive && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center justify-center gap-2 px-4"
          >
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <PhoneCall size={12} />
              <span>Background Call Active</span>
            </div>

            {isMuted && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-medium backdrop-blur-md">
                <MicOff size={12} className="text-red-400" />
                <span>Microphone Muted</span>
              </div>
            )}

            {isScreenSharing && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-300 text-xs font-medium backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" />
                <Monitor size={12} />
                <span>Screen Vision Active</span>
              </div>
            )}
          </motion.div>
        )}

        <AnimatePresence>
          {showTextInput && (
            <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onSubmit={handleTextSubmit}
              className="w-full max-w-md flex items-center gap-2 bg-white/5 border border-white/10 rounded-full p-1 pl-4 backdrop-blur-md shadow-2xl"
            >
              <input 
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a message to Zoya..."
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-sm"
                autoFocus
              />
              <button 
                type="submit"
                disabled={!textInput.trim()}
                className="p-2 rounded-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:hover:bg-violet-500 transition-colors"
              >
                <Send size={16} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={toggleListening}
            className={`
              group relative flex items-center gap-3 px-6 md:px-8 py-3.5 md:py-4 rounded-full font-medium tracking-wide transition-all duration-300 shadow-2xl text-sm md:text-base cursor-pointer
              ${
                isSessionActive
                  ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
                  : "bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:scale-105"
              }
            `}
          >
            {isSessionActive ? (
              <>
                <MicOff size={20} />
                <span>End Call</span>
              </>
            ) : (
              <>
                <Mic size={20} className="group-hover:animate-bounce" />
                <span>Start Call</span>
              </>
            )}
          </button>

          <button
            onClick={toggleMute}
            className={`
              group flex items-center gap-2.5 px-6 md:px-7 py-3.5 md:py-4 rounded-full font-medium tracking-wide transition-all duration-300 shadow-2xl text-sm md:text-base border cursor-pointer
              ${
                isMuted
                  ? "bg-red-500/25 text-red-300 border-red-500/60 hover:bg-red-500/35 ring-2 ring-red-500/30"
                  : "bg-white/10 text-white/90 border-white/20 hover:bg-white/20 hover:text-white"
              }
            `}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? (
              <>
                <MicOff size={20} className="text-red-400" />
                <span>Muted</span>
              </>
            ) : (
              <>
                <Mic size={20} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Mute</span>
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
