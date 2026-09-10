// developerDispatchService.ts - Automated Developer Contact & Telegram Bot Dispatch Service
// Dispatches user inquiries, messages, and contact requests directly to Royal Ankit Ahiran's Telegram via Telegram Bot API
// Also handles fetching and matching developer replies back to the specific user's session

import { getLiveAppUserStats } from "./firebaseService";

export const TELEGRAM_BOT_TOKEN = ""; // Supply only at runtime via a secure server environment.
export const TELEGRAM_CHAT_ID = "8491443372";

export const DEVELOPER_EMAIL = "ankit84340kumar@gmail.com";
export const DEVELOPER_PORTFOLIO = "https://royalankitahiranl.netlify.app";
export const DEVELOPER_TELEGRAM = "https://t.me/Royal_ankit_ahiran";
export const DEVELOPER_INSTAGRAM = "https://www.instagram.com/royal_ankit_ahiran";
export const DEVELOPER_YOUTUBE = "https://youtube.com/@royal_ankit_ahiran";

export interface DeveloperLeadPayload {
  name: string;
  phone?: string;
  message: string;
  timestamp?: string;
  requestId?: string;
}

export interface DeveloperReplyItem {
  text: string;
  timestamp: string;
  messageId: number;
  fromName?: string;
}

export interface DispatchedLeadItem extends DeveloperLeadPayload {
  id: string;
  requestId: string;
  telegramMessageId?: number;
  status: "sent" | "failed";
  replyStatus: "pending" | "replied";
  timestamp: string;
  replies: DeveloperReplyItem[];
  rawResponse?: string;
}

export interface CheckReplyResult {
  status: "reply_found" | "waiting_for_reply" | "no_messages_sent" | "error";
  hasReply: boolean;
  requestId?: string;
  senderName?: string;
  originalMessage?: string;
  originalTimestamp?: string;
  developerName?: string;
  latestReply?: string;
  replyTimestamp?: string;
  allReplies?: DeveloperReplyItem[];
  message: string;
}

/**
 * Generates a unique, short, human & machine-readable Request ID
 * Example: "REQ-7294"
 */
export function generateRequestId(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `REQ-${num}`;
}

/**
 * Calculates current exact Indian Standard Time (IST = UTC+5:30) timestamp
 * Format: "26 August 2026 | 04:30:10 PM IST"
 */
export function getFormattedISTTimestamp(date = new Date()): string {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utc = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
  const istTime = new Date(utc + istOffset);

  const day = String(istTime.getDate()).padStart(2, "0");
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const month = monthNames[istTime.getMonth()];
  const year = istTime.getFullYear();

  let hours = istTime.getHours();
  const minutes = String(istTime.getMinutes()).padStart(2, "0");
  const seconds = String(istTime.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, "0");

  return `${day} ${month} ${year} | ${formattedHours}:${minutes}:${seconds} ${ampm} IST`;
}

/**
 * Get all dispatched leads from LocalStorage
 */
export function getDispatchedLeadsLocally(): DispatchedLeadItem[] {
  try {
    const key = "zoya_developer_dispatches";
    const existing = localStorage.getItem(key);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    console.error("Failed to read local dispatches:", e);
    return [];
  }
}

/**
 * Save dispatched lead in LocalStorage history
 */
export function saveDispatchedLeadLocally(
  payload: DeveloperLeadPayload,
  timestamp: string,
  success: boolean,
  requestId: string,
  telegramMessageId?: number,
  rawResponse?: string
): void {
  try {
    const key = "zoya_developer_dispatches";
    const list = getDispatchedLeadsLocally();
    
    list.unshift({
      id: "lead_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      requestId,
      telegramMessageId,
      name: payload.name,
      phone: payload.phone || "Not Provided (Optional)",
      message: payload.message,
      timestamp,
      status: success ? "sent" : "failed",
      replyStatus: "pending",
      replies: [],
      rawResponse,
    });

    localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
  } catch (e) {
    console.error("Failed to save lead dispatch log:", e);
  }
}

/**
 * Helper to call Telegram Bot API using Vite proxy first to avoid browser CORS/network blocking,
 * with fallback to direct api.telegram.org.
 */
async function callTelegramApi(endpoint: string, options?: RequestInit): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  
  // Try local proxy first (works smoothly in Vite dev and preview)
  try {
    const proxyUrl = `/telegram-api/bot${TELEGRAM_BOT_TOKEN}/${cleanEndpoint}`;
    const proxyRes = await fetch(proxyUrl, options);
    if (proxyRes.status !== 404 && proxyRes.status !== 502 && proxyRes.status !== 504) {
      return proxyRes;
    }
  } catch {
    // If proxy fails or is not reachable, fallback to direct url
  }

  const directUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${cleanEndpoint}`;
  return fetch(directUrl, options);
}

/**
 * Escapes HTML characters for Telegram HTML mode
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Dispatches the contact information to Royal Ankit Ahiran via Telegram Bot API
 * Tags each outgoing message with a unique Request ID for reply-tracking
 */
export async function dispatchToDeveloperTelegram(
  payload: DeveloperLeadPayload
): Promise<{ success: boolean; timestamp: string; requestId: string; messageId?: number; error?: string }> {
  const timestamp = payload.timestamp || getFormattedISTTimestamp();
  const requestId = payload.requestId || generateRequestId();
  const name = (payload.name || "Anonymous User").trim();
  const phone = payload.phone && payload.phone.trim() ? payload.phone.trim() : "Not Provided (Optional)";
  const message = (payload.message || "").trim();

  const formattedHtml = `<b>🔔 New User Message for Developer (Zoya AI Assistant)</b>\n━━━━━━━━━━━━━━━━━━━━\n🔖 <b>Request ID:</b> #${requestId}\n👤 <b>Name:</b> ${escapeHtml(name)}\n📱 <b>Mobile:</b> ${escapeHtml(phone)}\n💬 <b>Message:</b> ${escapeHtml(message)}\n⏰ <b>Timestamp:</b> ${escapeHtml(timestamp)}\n🤖 <b>Dispatched via:</b> Zoya AI Assistant\n━━━━━━━━━━━━━━━━━━━━\n<i>💡 Developer Reply: Tap 'Reply' on this message in Telegram to send your answer back to the user via Zoya.</i>`;

  console.log(`[Telegram Bot Dispatch] Sending Request #${requestId} to Chat ID ${TELEGRAM_CHAT_ID}...`);

  try {
    const response = await callTelegramApi("sendMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: formattedHtml,
        parse_mode: "HTML",
      }),
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      const telegramMessageId = data.result?.message_id;
      console.log(`[Telegram Bot Dispatch] Delivery Successful: Message ID ${telegramMessageId}, Request #${requestId}`, data);
      saveDispatchedLeadLocally(payload, timestamp, true, requestId, telegramMessageId, JSON.stringify(data));
      return { success: true, timestamp, requestId, messageId: telegramMessageId };
    } else {
      console.warn("[Telegram Bot Dispatch] Telegram API Error Response:", data);
      saveDispatchedLeadLocally(payload, timestamp, false, requestId, undefined, JSON.stringify(data));
      return { 
        success: false, 
        timestamp, 
        requestId,
        error: data.description || "Failed to dispatch message to Telegram" 
      };
    }
  } catch (err: any) {
    console.error("[Telegram Bot Dispatch] Network / Fetch error:", err);
    saveDispatchedLeadLocally(payload, timestamp, false, requestId, undefined, err.message || "Network error");
    return { 
      success: false, 
      timestamp, 
      requestId,
      error: err.message || "Network error occurred while contacting Telegram" 
    };
  }
}

/**
 * Checks for replies from the developer via Telegram Bot API getUpdates
 * Matches replies directly to the user's specific dispatched request(s)
 */
export async function checkDeveloperReplyFromTelegram(
  specificRequestId?: string
): Promise<CheckReplyResult> {
  const leads = getDispatchedLeadsLocally();
  const sentLeads = leads.filter(l => l.status === "sent");

  if (sentLeads.length === 0) {
    return {
      status: "no_messages_sent",
      hasReply: false,
      message: "Aapne abhi tak developer ko koi message nahi bheja hai. Agar aap chahein toh pehle message bhej sakte hain."
    };
  }

  try {
    const response = await callTelegramApi("getUpdates?limit=50");
    const data = await response.json();

    if (response.ok && data.ok && Array.isArray(data.result)) {
      const updates = data.result;
      let hasUpdates = false;

      for (const update of updates) {
        const msg = update.message;
        if (!msg) continue;

        // Check if message is from the authorized developer chat or developer account
        const isFromDeveloper = String(msg.from?.id) === TELEGRAM_CHAT_ID || String(msg.chat?.id) === TELEGRAM_CHAT_ID;
        if (!isFromDeveloper) continue;

        const replyToMessageId = msg.reply_to_message?.message_id;
        const replyToText = msg.reply_to_message?.text || "";
        const replyText = (msg.text || "").trim();
        if (!replyText) continue;

        // Match against user's sent leads
        for (const lead of sentLeads) {
          const idMatches = (replyToMessageId && lead.telegramMessageId && replyToMessageId === lead.telegramMessageId);
          const reqTag = `#${lead.requestId}`;
          const tagMatches = replyToText.includes(reqTag) || replyToText.includes(lead.requestId) || replyText.includes(reqTag);

          // If matched, record this reply
          if (idMatches || tagMatches) {
            if (!lead.replies) lead.replies = [];
            const alreadySaved = lead.replies.some(r => r.messageId === msg.message_id);

            if (!alreadySaved) {
              lead.replies.push({
                text: replyText,
                timestamp: getFormattedISTTimestamp(new Date(msg.date * 1000)),
                messageId: msg.message_id,
                fromName: msg.from?.first_name || "Royal Ankit Ahiran"
              });
              lead.replyStatus = "replied";
              hasUpdates = true;
            }
          }
        }
      }

      // Persist any updated replies to localStorage
      if (hasUpdates) {
        localStorage.setItem("zoya_developer_dispatches", JSON.stringify(leads));
      }
    }
  } catch (err: any) {
    console.debug("[Telegram Reply Check] Could not fetch getUpdates:", err?.message || err);
  }

  // Find the targeted lead
  let targetLead = specificRequestId
    ? sentLeads.find(l => l.requestId.toLowerCase() === specificRequestId.toLowerCase())
    : sentLeads[0];

  if (!targetLead) {
    targetLead = sentLeads[0];
  }

  if (targetLead && targetLead.replies && targetLead.replies.length > 0) {
    const latest = targetLead.replies[targetLead.replies.length - 1];
    return {
      status: "reply_found",
      hasReply: true,
      requestId: targetLead.requestId,
      senderName: targetLead.name,
      originalMessage: targetLead.message,
      originalTimestamp: targetLead.timestamp,
      developerName: "Royal Ankit Ahiran",
      latestReply: latest.text,
      replyTimestamp: latest.timestamp,
      allReplies: targetLead.replies,
      message: `Developer Royal Ankit Ahiran has replied to Request #${targetLead.requestId}: "${latest.text}" (Sent at: ${latest.timestamp})`
    };
  }

  return {
    status: "waiting_for_reply",
    hasReply: false,
    requestId: targetLead?.requestId,
    senderName: targetLead?.name,
    originalMessage: targetLead?.message,
    originalTimestamp: targetLead?.timestamp,
    message: `Abhi tak developer Royal Ankit Ahiran ka reply nahi aaya hai (Request #${targetLead?.requestId}). Thoda intezaar karna hoga.`
  };
}

// Alias for backwards compatibility if needed
export const dispatchToDeveloperWhatsApp = dispatchToDeveloperTelegram;

/**
 * Standard 2-Option text presentation when a user asks to contact the developer
 */
export function getDeveloperContactOptionsText(isEnglish: boolean = false): string {
  if (isEnglish) {
    return `You have two ways to connect with my developer **Royal Ankit Ahiran**:

**Option 1:** You can reach out directly on his official social media or portfolio:
• **Portfolio:** [royalankitahiranl.netlify.app](${DEVELOPER_PORTFOLIO})
• **Telegram:** [@Royal_ankit_ahiran](${DEVELOPER_TELEGRAM})
• **YouTube:** [@royal_ankit_ahiran](${DEVELOPER_YOUTUBE})
• **Instagram:** [@royal_ankit_ahiran](${DEVELOPER_INSTAGRAM})
• **Email:** ${DEVELOPER_EMAIL}

**Option 2:** Or you can tell me your message, and I will forward it directly to my developer on Telegram.

Which option would you like to choose — the first or the second?`;
  }

  return `हमार डेवलपर **रॉयल अंकित अहिरान** से संपर्क करे खातिर रउआ लगे ठीक दू गो विकल्प बा:

**पहिला विकल्प (Option 1):** आप खुद मेरे डेवलपर के सोशल मीडिया या पोर्टफोलियो पर जा सकते हैं — लिंक बता देती हूँ:
• **पोर्टफोलियो:** [royalankitahiranl.netlify.app](${DEVELOPER_PORTFOLIO})
• **टेलीग्राम:** [@Royal_ankit_ahiran](${DEVELOPER_TELEGRAM})
• **यूट्यूब:** [@royal_ankit_ahiran](${DEVELOPER_YOUTUBE})
• **इंस्टाग्राम:** [@royal_ankit_ahiran](${DEVELOPER_INSTAGRAM})
• **ईमेल:** ${DEVELOPER_EMAIL}

**दूसरा विकल्प (Option 2):** या फिर जो भी बात है, मुझे बता दीजिए — मैं सीधा अपने डेवलपर तक पहुँचा दूँगी (टेलीग्राम के जरिए)।

कौन सा ऑप्शन चुनेंगे — पहला या दूसरा?`;
}

// -------------------------------------------------------------
// TELEGRAM BOT COMMANDS & DEVELOPER APP STATS QUERY SYSTEM
// -------------------------------------------------------------

const PROCESSED_COMMANDS_KEY = "zoya_processed_telegram_commands";

function getProcessedCommandIds(): number[] {
  try {
    const raw = localStorage.getItem(PROCESSED_COMMANDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markCommandIdProcessed(msgId: number): void {
  try {
    const list = getProcessedCommandIds();
    if (!list.includes(msgId)) {
      list.push(msgId);
      localStorage.setItem(PROCESSED_COMMANDS_KEY, JSON.stringify(list.slice(-100)));
    }
  } catch {}
}

/**
 * Checks if a given text from the developer is a stat or information command
 */
function isUserStatsCommand(text: string): boolean {
  const t = text.toLowerCase().trim();
  
  // Exact command triggers
  const slashCommands = ["/stats", "/users", "/count", "/login", "/logins", "/status", "/usercount", "/stat"];
  if (slashCommands.includes(t)) return true;

  // Natural language query triggers
  const patterns = [
    /kitne\s+(?:log|users?|members?)\s+(?:login|register|istemal|use)/i,
    /kitne\s+log\s+(?:hai|hain|hue\s+hai|hue\s+hain|kiye\s+hai)/i,
    /kitne\s+user\s+(?:hai|hain)/i,
    /how\s+many\s+users(?:\s+logged\s+in|\s+registered|\s+active)?/i,
    /total\s+(?:users?|logins?|accounts?|members?)/i,
    /user\s+count/i,
    /login\s+stats/i,
    /app\s+stats/i,
    /zoya\s+stats/i,
    /system\s+stats/i,
  ];

  return patterns.some((p) => p.test(t));
}

/**
 * Checks if a given text from the developer is a message/inquiries query
 */
function isMessagesStatsCommand(text: string): boolean {
  const t = text.toLowerCase().trim();
  const slashCommands = ["/messages", "/dispatches", "/leads", "/inquiries", "/inbox"];
  if (slashCommands.includes(t)) return true;

  const patterns = [
    /kitne\s+(?:messages?|inquiries|leads?)\s+(?:aaye|bheje|received)/i,
    /total\s+messages/i,
    /check\s+messages/i,
  ];

  return patterns.some((p) => p.test(t));
}

/**
 * Checks if the developer asked for help or start
 */
function isHelpCommand(text: string): boolean {
  const t = text.toLowerCase().trim();
  return t === "/start" || t === "/help" || t === "help";
}

/**
 * Send a reply message directly to the developer's chat
 */
async function sendTelegramReplyToDeveloper(
  replyHtml: string,
  replyToMessageId?: number
): Promise<boolean> {
  try {
    const payload: any = {
      chat_id: TELEGRAM_CHAT_ID,
      text: replyHtml,
      parse_mode: "HTML",
    };

    if (replyToMessageId) {
      payload.reply_to_message_id = replyToMessageId;
    }

    const res = await callTelegramApi("sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return res.ok && data.ok;
  } catch (e: any) {
    console.debug("[Telegram Command Reply] Could not send reply to developer:", e?.message || e);
    return false;
  }
}

/**
 * Processes incoming developer commands via Telegram Bot getUpdates
 * Restricts execution ONLY to the verified developer chat ID
 */
export async function processDeveloperTelegramCommands(): Promise<{
  processedCount: number;
  lastCommand?: string;
}> {
  try {
    const res = await callTelegramApi("getUpdates?limit=30");
    const data = await res.json();

    if (!res.ok || !data.ok || !Array.isArray(data.result)) {
      return { processedCount: 0 };
    }

    const updates = data.result;
    const processedIds = getProcessedCommandIds();
    let processedCount = 0;
    let lastCommand = "";

    for (const update of updates) {
      const msg = update.message;
      if (!msg || !msg.message_id) continue;

      const msgId = msg.message_id;
      if (processedIds.includes(msgId)) continue;

      // STRICT SECURITY RESTRICTION: Only process if sent from Developer's Chat ID or User ID
      const isFromDeveloper =
        String(msg.from?.id) === TELEGRAM_CHAT_ID || String(msg.chat?.id) === TELEGRAM_CHAT_ID;

      if (!isFromDeveloper) {
        // Mark as processed without responding to avoid any non-developer interaction
        markCommandIdProcessed(msgId);
        continue;
      }

      const text = (msg.text || "").trim();
      if (!text) {
        markCommandIdProcessed(msgId);
        continue;
      }

      // Check if message is a reply to a user lead (contains #REQ-xxxx tag or is a direct reply)
      const isReplyToLead =
        msg.reply_to_message ||
        /#REQ-\d+/i.test(text) ||
        text.toLowerCase().includes("reply to request");

      if (isReplyToLead) {
        // Handled by user lead reply system; don't trigger command handler
        continue;
      }

      // 1. STATS / USER COUNT COMMAND
      if (isUserStatsCommand(text)) {
        console.log(`[Telegram Command] Developer requested live app stats: "${text}"`);
        
        // Fetch accurate live data directly from Firestore database
        const stats = await getLiveAppUserStats();
        const dispatches = getDispatchedLeadsLocally();
        const istTime = getFormattedISTTimestamp();

        const replyHtml = `<b>📊 Zoya AI Assistant — Live App Statistics</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Total Registered & Logged-In Users:</b> <code>${stats.totalUsers}</code>
🔐 <b>Google Logins:</b> ${stats.googleUsers}
📱 <b>Email / Mobile Accounts:</b> ${stats.customAccounts}
📨 <b>User Inquiries Dispatched to You:</b> ${dispatches.length}
━━━━━━━━━━━━━━━━━━━━
💬 <i>Abhi tak <b>${stats.totalUsers}</b> log Zoya AI Assistant mein mandatory login / register karke jud chuke hain.</i>

⏰ <b>Live Query Time:</b> ${escapeHtml(istTime)}
🤖 <i>Data pulled real-time directly from Firestore database.</i>`;

        await sendTelegramReplyToDeveloper(replyHtml, msgId);
        markCommandIdProcessed(msgId);
        processedCount++;
        lastCommand = text;
      }
      // 2. MESSAGES / INQUIRIES STATS COMMAND
      else if (isMessagesStatsCommand(text)) {
        console.log(`[Telegram Command] Developer requested dispatches info: "${text}"`);
        const dispatches = getDispatchedLeadsLocally();
        const repliedCount = dispatches.filter((d) => d.replyStatus === "replied").length;
        const pendingCount = dispatches.length - repliedCount;
        const istTime = getFormattedISTTimestamp();

        const replyHtml = `<b>📨 Zoya AI — User Inquiries Report</b>
━━━━━━━━━━━━━━━━━━━━
📥 <b>Total Inquiries Received:</b> <code>${dispatches.length}</code>
✅ <b>Replied by You:</b> ${repliedCount}
⏳ <b>Pending / Awaiting Reply:</b> ${pendingCount}
━━━━━━━━━━━━━━━━━━━━
⏰ <b>Timestamp:</b> ${escapeHtml(istTime)}`;

        await sendTelegramReplyToDeveloper(replyHtml, msgId);
        markCommandIdProcessed(msgId);
        processedCount++;
        lastCommand = text;
      }
      // 3. HELP / START COMMAND
      else if (isHelpCommand(text)) {
        const istTime = getFormattedISTTimestamp();
        const replyHtml = `<b>🤖 Zoya AI — Developer Command Center</b>
━━━━━━━━━━━━━━━━━━━━
Namaste Royal Ankit Ahiran! Aap Telegram se seedhe commands bhej kar Zoya ka real-time data dekh sakte hain:

• <code>/stats</code> ya <i>"Kitne log login hue hain?"</i>
  ↳ <i>Live registered users aur login count</i>

• <code>/messages</code> ya <i>"Kitne messages aaye hain?"</i>
  ↳ <i>User inquiries aur reply status</i>

• <b>Direct Reply:</b> Kisi bhi user inquiry (#REQ-xxxx) par Telegram mein <b>'Reply'</b> karke message bhejein — Zoya user ke session mein aapka reply deliver kar degi!
━━━━━━━━━━━━━━━━━━━━
⏰ <b>Live Time:</b> ${escapeHtml(istTime)}`;

        await sendTelegramReplyToDeveloper(replyHtml, msgId);
        markCommandIdProcessed(msgId);
        processedCount++;
        lastCommand = text;
      }
    }

    return { processedCount, lastCommand };
  } catch (err: any) {
    console.debug("[Telegram Command Polling] Note:", err?.message || err);
    return { processedCount: 0 };
  }
}

let telegramListenerInterval: any = null;
let consecutivePollErrors = 0;

/**
 * Starts continuous background listener for developer Telegram commands
 */
export function startTelegramCommandListener(intervalMs: number = 10000): void {
  if (telegramListenerInterval) return;

  const runPoll = async () => {
    // Only poll if window is visible & online
    if (typeof document !== "undefined" && document.hidden) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    try {
      await processDeveloperTelegramCommands();
      consecutivePollErrors = 0;
    } catch {
      consecutivePollErrors++;
    }
  };

  // Run immediately once
  runPoll().catch(() => {});

  // Then poll periodically with backoff on failure
  telegramListenerInterval = setInterval(() => {
    if (consecutivePollErrors > 3 && Math.random() > 0.3) {
      return; // throttle back when offline or blocked
    }
    runPoll().catch(() => {});
  }, intervalMs);
}

/**
 * Stops background listener for developer Telegram commands
 */
export function stopTelegramCommandListener(): void {
  if (telegramListenerInterval) {
    clearInterval(telegramListenerInterval);
    telegramListenerInterval = null;
    consecutivePollErrors = 0;
  }
}


