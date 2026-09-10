/**
 * Voice Cloning Service for Zoya AI Voice Assistant
 * Integrates Custom Cloned Voice TTS (via ElevenLabs VoiceLab / Instant Voice Cloning)
 * Allows Zoya to speak using the developer's real voice recording (GF Voice Sample / Custom Cloned Voice ID).
 * 
 * Secure Configuration:
 * - Credentials (ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID) are securely loaded from
 *   environment variables (like GEMINI_API_KEY) and hidden from the user-facing UI.
 * - Seamless fallback to Gemini High-Definition TTS (Kore) if key/voice ID is not set.
 */

export interface VoiceCloneConfig {
  enabled: boolean;
  hasCredentials: boolean;
  modelId: string;
  stability: number;
  similarityBoost: number;
  provider: "elevenlabs" | "gemini_default";
}

const STORAGE_KEY = "zoya_voice_clone_preferences_v2";

// Server-side environment variables (Hidden from public UI)
const ENV_API_KEY = ((typeof process !== "undefined" && process.env?.ELEVENLABS_API_KEY) || "").trim();
const ENV_VOICE_ID = ((typeof process !== "undefined" && process.env?.ELEVENLABS_VOICE_ID) || "").trim();

export function hasSecureVoiceCredentials(): boolean {
  return Boolean(ENV_API_KEY && ENV_VOICE_ID);
}

export function getVoiceCloneConfig(): VoiceCloneConfig {
  const hasCreds = hasSecureVoiceCredentials();
  
  if (typeof window === "undefined") {
    return {
      enabled: hasCreds,
      hasCredentials: hasCreds,
      modelId: "eleven_multilingual_v2",
      stability: 0.5,
      similarityBoost: 0.85,
      provider: hasCreds ? "elevenlabs" : "gemini_default",
    };
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        enabled: hasCreds ? (parsed.enabled ?? true) : false,
        hasCredentials: hasCreds,
        modelId: parsed.modelId || "eleven_multilingual_v2",
        stability: parsed.stability ?? 0.5,
        similarityBoost: parsed.similarityBoost ?? 0.85,
        provider: (hasCreds && (parsed.enabled ?? true)) ? "elevenlabs" : "gemini_default",
      };
    }
  } catch (e) {
    console.warn("Error loading voice clone preferences:", e);
  }

  return {
    enabled: hasCreds,
    hasCredentials: hasCreds,
    modelId: "eleven_multilingual_v2",
    stability: 0.5,
    similarityBoost: 0.85,
    provider: hasCreds ? "elevenlabs" : "gemini_default",
  };
}

export function saveVoiceCloneConfig(config: Partial<VoiceCloneConfig>): VoiceCloneConfig {
  const current = getVoiceCloneConfig();
  const updated: VoiceCloneConfig = {
    ...current,
    ...config,
    hasCredentials: hasSecureVoiceCredentials(),
    provider: (hasSecureVoiceCredentials() && (config.enabled ?? current.enabled)) ? "elevenlabs" : "gemini_default",
  };
  
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        enabled: updated.enabled,
        modelId: updated.modelId,
        stability: updated.stability,
        similarityBoost: updated.similarityBoost,
      }));
    } catch (e) {
      console.warn("Failed to persist voice clone preferences:", e);
    }
  }
  return updated;
}

/**
 * Generate Spoken Audio via ElevenLabs Voice Cloning API
 * Returns base64 encoded audio (audio/mpeg) or null if not configured/failed
 */
export async function getClonedVoiceAudio(text: string): Promise<{ audioBase64: string; format: "mp3" | "pcm" } | null> {
  const config = getVoiceCloneConfig();

  // If voice cloning is not enabled or environment variables are not configured, return null to use Gemini fallback
  if (!config.enabled || !ENV_API_KEY || !ENV_VOICE_ID) {
    return null;
  }

  const cleanText = text.replace(/[*#_`]/g, "").trim();
  if (!cleanText) return null;

  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${ENV_VOICE_ID}?optimize_streaming_latency=3`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ENV_API_KEY,
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: config.modelId || "eleven_multilingual_v2",
        voice_settings: {
          stability: config.stability ?? 0.5,
          similarity_boost: config.similarityBoost ?? 0.85,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`ElevenLabs TTS error [${response.status}]:`, errBody);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    
    // Convert ArrayBuffer to Base64
    let binary = "";
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const audioBase64 = btoa(binary);

    return {
      audioBase64,
      format: "mp3",
    };
  } catch (error) {
    console.error("ElevenLabs Custom Cloned Voice Error:", error);
    return null;
  }
}

