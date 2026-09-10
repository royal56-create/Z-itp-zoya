import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Smartphone, Monitor, HardDrive, Shield, User, Clock, Globe, Cpu, Award } from "lucide-react";
import { DeviceInfo } from "./deviceManager";

interface DeviceInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceInfo: DeviceInfo;
  voiceCount?: number;
  onClearData?: () => void;
  onOpenPortfolio?: () => void;
}

export default function DeviceInfoModal({
  isOpen,
  onClose,
  deviceInfo,
  voiceCount = 0,
  onClearData,
  onOpenPortfolio,
}: DeviceInfoModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[#0f0f16] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5 text-white relative overflow-hidden"
        >
          {/* Background Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 blur-3xl pointer-events-none rounded-full" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-500/10 blur-3xl pointer-events-none rounded-full" />

          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/15 text-violet-400 border border-violet-500/30">
                <User size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">User Device Profile</h3>
                <p className="text-xs text-white/50">Unique session & device identifier</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* User ID Badge */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-violet-900/30 via-purple-900/20 to-pink-900/30 border border-violet-500/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-violet-300/70 block">
                Unique User Identifier
              </span>
              <span className="text-lg font-mono font-bold text-violet-200 tracking-wider">
                {deviceInfo.userId}
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Active Session
            </span>
          </div>

          {/* Device Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-white/40">
                <Monitor size={14} className="text-violet-400" />
                <span>Device & OS</span>
              </div>
              <p className="font-medium text-white/90 truncate">{deviceInfo.platform} ({deviceInfo.deviceType})</p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-white/40">
                <Cpu size={14} className="text-pink-400" />
                <span>Browser</span>
              </div>
              <p className="font-medium text-white/90 truncate">{deviceInfo.browser}</p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-white/40">
                <Smartphone size={14} className="text-cyan-400" />
                <span>Screen Resolution</span>
              </div>
              <p className="font-medium text-white/90">{deviceInfo.screenResolution}</p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-white/40">
                <Globe size={14} className="text-emerald-400" />
                <span>Locale & Zone</span>
              </div>
              <p className="font-medium text-white/90 truncate">{deviceInfo.language} ({deviceInfo.timeZone})</p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-white/40">
                <HardDrive size={14} className="text-amber-400" />
                <span>Voice Recordings</span>
              </div>
              <p className="font-medium text-white/90">{voiceCount} recordings (Persistent)</p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-white/40">
                <Clock size={14} className="text-indigo-400" />
                <span>First Registration</span>
              </div>
              <p className="font-medium text-white/90 truncate">
                {new Date(deviceInfo.firstSeen).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Persistence Note */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2.5 text-[11px] text-white/60">
            <Shield size={16} className="text-violet-400 shrink-0" />
            <span>
              Voice history is stored securely under your unique User ID (<code className="text-violet-300 font-mono">{deviceInfo.userId}</code>) and remains permanently preserved in Firestore.
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              {onOpenPortfolio && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenPortfolio();
                  }}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white text-xs font-medium transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Award size={14} />
                  <span>Creator Portfolio</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
