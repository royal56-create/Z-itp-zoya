import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Mic, Volume2, Sparkles, Check, Info, Sliders, Play, Loader2, ShieldCheck, Lock } from "lucide-react";
import { getVoiceCloneConfig, saveVoiceCloneConfig, VoiceCloneConfig } from "./voiceCloningService";
import { speakZoyaVoice, stopAllSpeech } from "./audioUtils";

interface VoiceCloneModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VoiceCloneModal({ isOpen, onClose }: VoiceCloneModalProps) {
  const [config, setConfig] = useState<VoiceCloneConfig>(() => getVoiceCloneConfig());
  const [isSaved, setIsSaved] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testText, setTestText] = useState("का हो! हम ज़ोया बानी। हमार आवाज़ अब रउआ के कस्टम क्लोन वॉयस में सुनाई दी!");

  if (!isOpen) return null;

  const handleSave = () => {
    const updated = saveVoiceCloneConfig(config);
    setConfig(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleTestVoice = async () => {
    if (isTesting) {
      stopAllSpeech();
      setIsTesting(false);
      return;
    }
    try {
      setIsTesting(true);
      // Temporarily save to test with current settings
      saveVoiceCloneConfig(config);
      await speakZoyaVoice(testText);
    } catch (e) {
      console.error("Test voice failed:", e);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-[#0f0f16] border border-white/10 rounded-2xl p-6 w-full max-w-xl shadow-2xl space-y-5 text-white relative overflow-hidden max-h-[90vh] overflow-y-auto"
        >
          {/* Ambient Glows */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-pink-500/10 blur-3xl pointer-events-none rounded-full" />
          <div className="absolute bottom-0 left-0 w-36 h-36 bg-violet-500/10 blur-3xl pointer-events-none rounded-full" />

          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-pink-500/20 to-violet-500/20 text-pink-400 border border-pink-500/30">
                <Mic size={22} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <span>Custom Voice Cloning (Zoya)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 uppercase tracking-wider">
                    Secure
                  </span>
                </h3>
                <p className="text-xs text-white/50">Custom Voice Cloning powered by ElevenLabs VoiceLab</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Status Banner */}
          <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            config.enabled && config.hasCredentials
              ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
              : "bg-violet-950/20 border-violet-500/30 text-violet-200"
          }`}>
            <div className="flex items-center gap-2.5 text-xs">
              {config.enabled && config.hasCredentials ? (
                <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
              ) : (
                <Volume2 size={18} className="text-violet-400 shrink-0" />
              )}
              <div>
                <p className="font-semibold">
                  {config.enabled && config.hasCredentials
                    ? "Custom Voice Cloning Active"
                    : "Gemini High-Definition Voice Active (Kore)"}
                </p>
                <p className="text-[11px] opacity-80">
                  {config.enabled && config.hasCredentials
                    ? `Voice Model: ElevenLabs (${config.modelId}) • Cloned voice active across calls & speech.`
                    : "Using default Gemini voice. Enable toggle to switch to the cloned voice."}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
            </label>
          </div>

          {/* Secure Environment Notice (Credentials Hidden) */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-3 text-xs text-white/70">
            <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20 shrink-0">
              <Lock size={16} />
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-white/90">Protected Developer Credentials</p>
              <p className="text-[11px] text-white/50 leading-relaxed">
                API Key &amp; Cloned Voice ID are securely loaded from project environment variables and completely hidden from public users.
              </p>
            </div>
          </div>

          {/* Voice Tuning Parameters */}
          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-white/70 font-medium mb-1.5 flex items-center gap-1.5">
                  <Sliders size={14} className="text-cyan-400" />
                  <span>Model Architecture</span>
                </label>
                <select
                  value={config.modelId}
                  onChange={(e) => setConfig({ ...config, modelId: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-pink-500 text-xs"
                >
                  <option value="eleven_multilingual_v2" className="bg-[#12121c]">Multilingual v2 (High Quality)</option>
                  <option value="eleven_turbo_v2_5" className="bg-[#12121c]">Turbo v2.5 (Fastest Latency)</option>
                  <option value="eleven_flash_v2_5" className="bg-[#12121c]">Flash v2.5 (Ultra Fast)</option>
                </select>
              </div>

              <div>
                <label className="block text-white/70 font-medium mb-1.5 flex items-center justify-between">
                  <span>Voice Stability ({Math.round(config.stability * 100)}%)</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={config.stability}
                  onChange={(e) => setConfig({ ...config, stability: parseFloat(e.target.value) })}
                  className="w-full accent-pink-500 mt-2"
                />
              </div>
            </div>
          </div>

          {/* Test Voice Section */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white/80 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-400" />
                <span>Test Spoken Voice Sample</span>
              </span>
              <button
                type="button"
                onClick={handleTestVoice}
                disabled={isTesting}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow cursor-pointer"
              >
                {isTesting ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                <span>{isTesting ? "Speaking..." : "Play Voice"}</span>
              </button>
            </div>
            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/90 placeholder-white/30 focus:outline-none focus:border-pink-500"
            />
          </div>

          {/* Developer Guide Info */}
          <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/20 text-[11px] text-white/70 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-violet-300">
              <Info size={14} />
              <span>Voice Setup Summary:</span>
            </div>
            <p className="text-white/60 leading-relaxed">
              Zoya uses the developer's 1-minute real voice sample processed into an ElevenLabs Cloned Voice. If external credentials are not set, Zoya automatically speaks using high-definition Gemini TTS.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-medium transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white text-xs font-semibold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              {isSaved ? <Check size={14} className="text-emerald-300" /> : null}
              <span>{isSaved ? "Saved Successfully!" : "Save Preferences"}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
