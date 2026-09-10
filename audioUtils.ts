import { getRoyalAudio } from "./geminiService";
import { getVoiceCloneConfig, getClonedVoiceAudio } from "./voiceCloningService";

let currentActiveAudioSource: AudioBufferSourceNode | null = null;
let currentActiveAudioElement: HTMLAudioElement | null = null;
let currentActiveAudioCtx: AudioContext | null = null;

/**
 * Plays base64 audio (supports both raw PCM 24kHz and MP3 from ElevenLabs)
 */
export async function playPCM(
  audioInput: string | { data: string; format?: "pcm" | "mp3" },
  formatOverride?: "pcm" | "mp3"
): Promise<void> {
  stopAllSpeech();

  const base64Data = typeof audioInput === "string" ? audioInput : audioInput.data;
  const format = formatOverride || (typeof audioInput === "object" ? audioInput.format : "pcm");

  if (!base64Data) return;

  // If format is MP3 (e.g. from ElevenLabs Custom Voice Clone)
  if (format === "mp3" || base64Data.startsWith("//") || base64Data.startsWith("SUQz") || base64Data.startsWith("/+M")) {
    return new Promise<void>((resolve) => {
      try {
        const audio = new Audio(`data:audio/mpeg;base64,${base64Data}`);
        currentActiveAudioElement = audio;
        audio.onended = () => {
          if (currentActiveAudioElement === audio) {
            currentActiveAudioElement = null;
          }
          resolve();
        };
        audio.onerror = (e) => {
          console.warn("Audio element playback error, falling back to WebAudio:", e);
          playAudioViaWebAudio(base64Data).then(resolve);
        };
        audio.play().catch((err) => {
          console.warn("Autoplay blocked or audio play failed:", err);
          playAudioViaWebAudio(base64Data).then(resolve);
        });
      } catch (e) {
        console.error("HTML5 Audio Playback error:", e);
        playAudioViaWebAudio(base64Data).then(resolve);
      }
    });
  }

  // Raw PCM Playback (Default Gemini TTS)
  return playRawPCM(base64Data);
}

async function playAudioViaWebAudio(base64Data: string): Promise<void> {
  try {
    const AudioContextClass遵 = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass遵) return;
    
    const audioCtx = new AudioContextClass遵();
    currentActiveAudioCtx = audioCtx;

    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes不易 = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes不易[i] = binaryString.charCodeAt(i);
    }

    const decodedBuffer = await audioCtx.decodeAudioData(bytes不易.buffer);
    const source = audioCtx.createBufferSource();
    currentActiveAudioSource = source;
    source.buffer = decodedBuffer;
    source.connect(audioCtx.destination);
    source.start();

    return new Promise<void>((resolve) => {
      source.onended = () => {
        if (currentActiveAudioSource === source) {
          currentActiveAudioSource = null;
        }
        resolve();
      };
    });
  } catch (err) {
    console.error("WebAudio decode error:", err);
  }
}

async function playRawPCM(base64Data: string): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("AudioContext not supported");
      return;
    }
    const audioCtx述 = new AudioContextClass({ sampleRate: 24000 });
    currentActiveAudioCtx = audioCtx述;
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const buffer = new Int16Array(bytes.buffer);
    const audioBuffer = audioCtx述.createBuffer(1, buffer.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
      channelData[i] = buffer[i] / 32768.0;
    }
    const source = audioCtx述.createBufferSource();
    currentActiveAudioSource = source;
    source.buffer = audioBuffer;
    source.connect(audioCtx述.destination);
    source.start();
    
    return new Promise<void>(resolve => {
      source.onended = () => {
        if (currentActiveAudioSource === source) {
          currentActiveAudioSource = null;
        }
        resolve();
      };
    });
  } catch (error) {
    console.error("Error playing raw PCM audio:", error);
  }
}

export function stopAllSpeech(): void {
  if (currentActiveAudioElement) {
    try {
      currentActiveAudioElement.pause();
      currentActiveAudioElement.currentTime = 0;
    } catch (_) {}
    currentActiveAudioElement = null;
  }
  if (currentActiveAudioSource) {
    try {
      currentActiveAudioSource.stop();
    } catch (_) {}
    currentActiveAudioSource = null;
  }
  if (currentActiveAudioCtx) {
    try {
      currentActiveAudioCtx.close();
    } catch (_) {}
    currentActiveAudioCtx = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
  }
}

export async function speakZoyaVoice(text: string): Promise<void> {
  stopAllSpeech();
  if (!text || !text.trim()) return;

  // 1. Try Custom Cloned Voice or Gemini TTS Audio
  try {
    const audioResult = await getRoyalAudio(text);
    if (audioResult) {
      if (typeof audioResult === "object" && audioResult.data) {
        await playPCM(audioResult.data, audioResult.format);
        return;
      } else if (typeof audioResult === "string") {
        await playPCM(audioResult, "pcm");
        return;
      }
    }
  } catch (err) {
    console.warn("Cloned/Gemini TTS audio failed, falling back to Web SpeechSynthesis:", err);
  }

  // 2. Fallback to Browser Speech Synthesis (Zero-Drop guarantee on any device)
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    return new Promise<void>((resolve) => {
      try {
        const cleanText = text.replace(/[*#_`]/g, "").trim();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = "hi-IN";
        utterance.rate = 0.95;
        utterance.pitch = 1.1;

        const voices = window.speechSynthesis.getVoices();
        const indianVoice = voices.find(v => v.lang.includes("hi") || v.lang.includes("IN") || v.name.includes("India") || v.name.includes("Hindi"));
        if (indianVoice) {
          utterance.voice = indianVoice;
        }

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.error("SpeechSynthesis error:", e);
        resolve();
      }
    });
  }
}

export const speakWithFallback = speakZoyaVoice;

// Realistic Outbound Phone Call Ringback Tone Synthesizer
let activeRingAudioCtx: AudioContext | null = null;
let activeRingInterval: any = null;

export function startPhoneRingTone(): void {
  stopPhoneRingTone();
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    activeRingAudioCtx = new AudioContextClass();
    const playBurst = () => {
      if (!activeRingAudioCtx || activeRingAudioCtx.state === "closed") return;
      
      const now = activeRingAudioCtx.currentTime;
      const osc1 = activeRingAudioCtx.createOscillator();
      const osc2 = activeRingAudioCtx.createOscillator();
      const gain = activeRingAudioCtx.createGain();

      osc1.frequency.value = 440; // 440 Hz standard dialer tone
      osc2.frequency.value = 480; // 480 Hz standard dialer tone

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain.gain.setValueAtTime(0.15, now + 1.2);
      gain.gain.linearRampToValueAtTime(0, now + 1.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(activeRingAudioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.3);
      osc2.stop(now + 1.3);
    };

    playBurst();
    activeRingInterval = setInterval(playBurst, 3500);
  } catch (e) {
    console.warn("Could not start ringback tone audio:", e);
  }
}

export function stopPhoneRingTone(): void {
  if (activeRingInterval) {
    clearInterval(activeRingInterval);
    activeRingInterval = null;
  }
  if (activeRingAudioCtx) {
    try {
      activeRingAudioCtx.close();
    } catch (_) {}
    activeRingAudioCtx = null;
  }
}
