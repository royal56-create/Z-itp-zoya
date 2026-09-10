export interface DeviceInfo {
  userId: string;
  deviceType: "Mobile" | "Tablet" | "Desktop";
  platform: string;
  browser: string;
  screenResolution: string;
  language: string;
  timeZone: string;
  firstSeen: string;
  lastActive: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "Royal";
  text: string;
  timestamp: string;
  userId: string;
  createdAt?: number;
}

const USER_ID_KEY = "zoya_user_id";
const DEVICE_INFO_KEY = "zoya_device_info";
const CHAT_HISTORY_KEY_PREFIX = "zoya_chat_history_";

/**
 * Generates or retrieves the unique user ID for this device/browser
 */
export function getOrCreateUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    const randomHex = Math.random().toString(36).substring(2, 10).toUpperCase();
    userId = `USR-${randomHex}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

/**
 * Detects browser details from User-Agent
 */
function getBrowserName(ua: string): string {
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/")) return "Safari";
  if (ua.includes("OPR/") || ua.includes("Opera/")) return "Opera";
  return "Browser";
}

/**
 * Detects device type
 */
function getDeviceType(ua: string): "Mobile" | "Tablet" | "Desktop" {
  if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "Mobile";
  return "Desktop";
}

/**
 * Gets or updates device information
 */
export function getDeviceInfo(): DeviceInfo {
  const userId = getOrCreateUserId();
  const ua = navigator.userAgent;
  const now = new Date().toISOString();

  let existing = localStorage.getItem(DEVICE_INFO_KEY);
  let firstSeen = now;

  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (parsed.firstSeen) firstSeen = parsed.firstSeen;
    } catch (e) {
      console.error("Failed to parse device info", e);
    }
  }

  const info: DeviceInfo = {
    userId,
    deviceType: getDeviceType(ua),
    platform: navigator.platform || "Web",
    browser: getBrowserName(ua),
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language || "en-US",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    firstSeen,
    lastActive: now,
  };

  localStorage.setItem(DEVICE_INFO_KEY, JSON.stringify(info));
  return info;
}

/**
 * Loads persistent chat history for the user
 */
export function loadChatHistory(userId?: string): ChatMessage[] {
  const id = userId || getOrCreateUserId();
  const saved = localStorage.getItem(`${CHAT_HISTORY_KEY_PREFIX}${id}`) || localStorage.getItem("Royal_chat_history");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Migrate legacy format if needed
      return parsed.map((m: any) => ({
        id: m.id || Date.now().toString(),
        sender: m.sender || "user",
        text: m.text || "",
        timestamp: m.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        userId: m.userId || id,
      }));
    } catch (e) {
      console.error("Failed to load chat history", e);
    }
  }
  return [];
}

/**
 * Saves chat history persistently for the unique user ID
 */
export function saveChatHistory(messages: ChatMessage[], userId?: string): void {
  const id = userId || getOrCreateUserId();
  localStorage.setItem(`${CHAT_HISTORY_KEY_PREFIX}${id}`, JSON.stringify(messages));
  // Keep legacy key synced for backward compatibility
  localStorage.setItem("Royal_chat_history", JSON.stringify(messages));
}

/**
 * Clears chat history for the user
 */
export function clearChatHistory(userId?: string): void {
  const id = userId || getOrCreateUserId();
  localStorage.removeItem(`${CHAT_HISTORY_KEY_PREFIX}${id}`);
  localStorage.removeItem("Royal_chat_history");
}
