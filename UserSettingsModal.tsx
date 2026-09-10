import React, { useState } from "react";
import { 
  X, User, Mail, Shield, LogOut, Award, Sparkles, Volume2, 
  Bell, Smartphone, Clock, CheckCircle2, Globe, Copy, Check,
  History, MessageSquare, ChevronRight, Mic
} from "lucide-react";
import { AppUserProfile, logoutUser } from "./firebaseService";
import { 
  loadUserSettings, 
  saveUserSettings, 
  loadUserReminders, 
  getTodayStudyMinutes,
  UserSettings 
} from "./userStorageService";
import { motion } from "motion/react";

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AppUserProfile;
  voiceCount?: number;
  onLogout: () => void;
  onOpenPortfolio: () => void;
  onOpenVoiceHistory: () => void;
}

export default function UserSettingsModal({
  isOpen,
  onClose,
  user,
  voiceCount = 0,
  onLogout,
  onOpenPortfolio,
  onOpenVoiceHistory,
}: UserSettingsModalProps) {
  const [settings, setSettings] = useState<UserSettings>(() => loadUserSettings(user.uid));
  const [copiedUid, setCopiedUid] = useState(false);
  const [remindersCount] = useState(() => loadUserReminders(user.uid).length);
  const [studyMinutes] = useState(() => getTodayStudyMinutes(user.uid));

  if (!isOpen) return null;

  const handleToggleSetting = (key: keyof UserSettings) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    saveUserSettings(user.uid, updated);
  };

  const handleCopyUid = () => {
    navigator.clipboard.writeText(user.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleLogoutClick = async () => {
    await logoutUser();
    onLogout();
    onClose();
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-[#131316] border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden text-white font-sans"
      >
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/10 blur-[60px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-600/10 blur-[60px] rounded-full pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer z-10"
        >
          <X size={18} />
        </button>

        {/* User Profile Header */}
        <div className="flex items-center gap-4 mb-5 pt-1">
          <div className="relative">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full object-cover ring-2 ring-red-500/70 shadow-lg shadow-red-500/20"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-red-600 to-cyan-500 flex items-center justify-center font-bold text-xl text-white ring-2 ring-white/20 shadow-lg">
                {getInitials(user.displayName)}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-[#131316]" title="Online" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white truncate">
                {user.displayName}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase">
                {user.provider}
              </span>
            </div>
            <p className="text-xs text-white/60 truncate flex items-center gap-1 mt-0.5">
              <Mail size={12} className="shrink-0 text-white/40" />
              <span>{user.email || user.phoneNumber || "No contact info"}</span>
            </p>
            <button
              onClick={handleCopyUid}
              className="mt-1 text-[10px] font-mono text-white/40 hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
              title="Click to copy User ID"
            >
              <span>UID: {user.uid.substring(0, 14)}...</span>
              {copiedUid ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
            </button>
          </div>
        </div>

        {/* Session Status Banner */}
        <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-2.5 text-xs">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-emerald-200">Persistent Active Session</p>
            <p className="text-[11px] text-emerald-300/80">You will stay permanently logged in on this browser.</p>
          </div>
        </div>

        {/* User Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button 
            onClick={() => {
              onClose();
              onOpenVoiceHistory();
            }}
            className="p-2.5 rounded-2xl bg-black/40 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 text-center transition-all cursor-pointer group"
            title="Click to view full voice history"
          >
            <p className="text-base font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors">{voiceCount}</p>
            <p className="text-[9px] font-mono text-white/50 group-hover:text-cyan-300/80 uppercase">Voice</p>
          </button>
          <div className="p-2.5 rounded-2xl bg-black/40 border border-white/10 text-center">
            <p className="text-base font-bold text-amber-400">{remindersCount}</p>
            <p className="text-[9px] font-mono text-white/50 uppercase">Remind</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-black/40 border border-white/10 text-center">
            <p className="text-base font-bold text-emerald-400">{studyMinutes}m</p>
            <p className="text-[9px] font-mono text-white/50 uppercase">Study</p>
          </div>
        </div>

        {/* User Preferences Toggles */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs">
            <div className="flex items-center gap-2 text-white/80">
              <Volume2 size={15} className="text-cyan-400" />
              <span>Voice & Sound Effects</span>
            </div>
            <button
              onClick={() => handleToggleSetting("soundEffectsEnabled")}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                settings.soundEffectsEnabled ? "bg-cyan-500" : "bg-white/20"
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${
                  settings.soundEffectsEnabled ? "left-4.5" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs">
            <div className="flex items-center gap-2 text-white/80">
              <Bell size={15} className="text-red-400" />
              <span>Daily AI Greeting</span>
            </div>
            <button
              onClick={() => handleToggleSetting("dailyGreetingEnabled")}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                settings.dailyGreetingEnabled ? "bg-red-500" : "bg-white/20"
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${
                  settings.dailyGreetingEnabled ? "left-4.5" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs">
            <div className="flex items-center gap-2 text-white/80">
              <Sparkles size={15} className="text-violet-400" />
              <span>Wake Word ("Hey Zoya")</span>
            </div>
            <button
              onClick={() => handleToggleSetting("wakeWordEnabled")}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                settings.wakeWordEnabled ? "bg-violet-500" : "bg-white/20"
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${
                  settings.wakeWordEnabled ? "left-4.5" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          {/* Dedicated Voice History Button */}
          <button
            onClick={() => {
              onClose();
              onOpenVoiceHistory();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-xs font-semibold flex items-center justify-between text-cyan-200 transition-all cursor-pointer group shadow-sm hover:scale-[1.01]"
          >
            <div className="flex items-center gap-2">
              <History size={16} className="text-cyan-400 group-hover:rotate-[-20deg] transition-transform" />
              <span>Voice History</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/30 text-cyan-300 font-mono font-bold border border-cyan-500/40">
                {voiceCount} {voiceCount === 1 ? "record" : "records"}
              </span>
              <ChevronRight size={14} className="text-cyan-400/60 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenPortfolio();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold flex items-center justify-center gap-2 text-red-300 transition-colors cursor-pointer"
          >
            <Award size={15} className="text-red-400" />
            <span>Developer Royal Ankit Ahiran Portfolio</span>
          </button>

          <button
            onClick={handleLogoutClick}
            className="w-full py-2.5 px-4 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-semibold flex items-center justify-center gap-2 text-red-400 transition-colors cursor-pointer"
          >
            <LogOut size={15} />
            <span>Sign Out of Session</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
