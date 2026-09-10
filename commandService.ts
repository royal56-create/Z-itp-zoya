import {
  AppLaunchOptions,
  getGenericAppLaunchConfig,
  getWhatsAppLaunchConfig,
  getInstagramLaunchConfig,
  getYouTubeLaunchConfig,
  getFacebookLaunchConfig,
  getSpotifyLaunchConfig,
  getTelegramLaunchConfig,
} from "./appLauncher";
export interface CommandResult {
  action: string;
  url?: string;
  isBrowserAction: boolean;
  type?: "navigation" | "whatsapp" | "instagram" | "screen" | "youtube" | "facebook" | "spotify" | "telegram";
  appLaunchConfig?: AppLaunchOptions;
}

export function processCommand(command: string): CommandResult {
  const lowerCmd = command.toLowerCase().trim();

  // 0.1 Hacking Refusal & Royal Ankit Ahiran Praise
  if (
    lowerCmd.includes("hack") ||
    lowerCmd.includes("hacking") ||
    lowerCmd.includes("heck") ||
    lowerCmd.includes("spy on") ||
    lowerCmd.includes("crack password") ||
    lowerCmd.includes("wifi hack")
  ) {
    return {
      action:
        "अरे मालिक! हैकिंग-वैकिंग के काम हम ना करीं, हमार काम त रउआ सेवा कईल बा। अगर रउआ साइबर सुरक्षा भा कोडिंग सीखे के बा त हमार निर्माता Royal Ankit Ahiran जी के गाइडेंस लीं!",
      isBrowserAction: false,
    };
  }

  // 0.2 Call Intent Refusal
  // If user asks to make a call, explicitly refuse with friendly Bhojpuri explanation
  const isCallIntent =
    /call|phone\s+lagao|phone\s+karo|dial|make\s+a\s+call|laga\s+do\s+call|call\s+karo/i.test(lowerCmd);

  if (isCallIntent) {
    return {
      action:
        "माफ़ करीं भाई, हम कॉल ना लगा सकेनी! ई सिस्टम कॉल खातिर सेट नइखे। हम रउआ से बात कर सकेनी, कौनो वेबसाइट या ऐप खोल सकेनी, भा बाकी काम में मदद कर सकेनी, बाकी फोन कॉल हमरा से ना हो पाई!",
      isBrowserAction: false,
    };
  }

  // 1. Instagram Messages / DMs
  if (
    lowerCmd.includes("instagram message") ||
    lowerCmd.includes("instagram dm") ||
    lowerCmd.includes("check instagram") ||
    lowerCmd.includes("instagram message dekho") ||
    lowerCmd.includes("instagram khol ke message") ||
    lowerCmd.includes("open instagram message") ||
    lowerCmd.includes("open instagram dm") ||
    lowerCmd.includes("instagram inbox")
  ) {
    const launchConfig = getInstagramLaunchConfig(true);
    return {
      action: "जी मालिक, इंस्टाग्राम मैसेज इनबॉक्स खोल देलीं! अगर ऐप इनस्टॉल बा त सीधे ऐप में खुली, ना त ऑफिशियल वेबसाइट में।",
      url: launchConfig.webUrl,
      appLaunchConfig: launchConfig,
      isBrowserAction: true,
      type: "instagram",
    };
  }

  // 2. WhatsApp Direct Chat / Message: "Send a WhatsApp message to [number/contact] saying [message]"
  const waMatch =
    lowerCmd.match(
      /^(?:send|bhejo)\s+(?:a\s+)?whatsapp\s+message\s+to\s+([\d\+\s\w]+)\s+(?:saying|baat|likh\s+ke)\s+(.+)$/i
    ) ||
    lowerCmd.match(/^whatsapp\s+message\s+(?:to|pe)\s+([\d\+\s\w]+)\s+(?:saying|bhejo|baat)\s+(.+)$/i);

  if (waMatch) {
    const contactRaw = waMatch[1].trim();
    const cleanNumber = contactRaw.replace(/[^\d\+]/g, "");
    const rawMsg = waMatch[2].trim();

    const launchConfig = getWhatsAppLaunchConfig(rawMsg, cleanNumber || contactRaw);
    return {
      action: `जी मालिक, ${contactRaw} खातिर व्हाट्सएप्प में मैसेज तैयार कर देलीं!`,
      url: launchConfig.webUrl,
      appLaunchConfig: launchConfig,
      isBrowserAction: true,
      type: "whatsapp",
    };
  }

  // 3. YouTube Search: "Play [song/video] on YouTube"
  const ytMatch =
    lowerCmd.match(/^play\s+(.+?)\s+on\s+youtube$/i) ||
    lowerCmd.match(/^youtube\s+par\s+(.+?)\s+(?:chalao|play\s+karo)$/i);
  if (ytMatch) {
    const query = ytMatch[1].trim();
    const launchConfig = getYouTubeLaunchConfig(query);
    return {
      action: `जी मालिक, यूट्यूब पर "${query}" चला देलीं!`,
      url: launchConfig.webUrl,
      appLaunchConfig: launchConfig,
      isBrowserAction: true,
      type: "youtube",
    };
  }

  // 4. Spotify Search: "Search/Play [song] on Spotify"
  const spotifyMatch =
    lowerCmd.match(/^(?:search|play)\s+(.+?)\s+on\s+spotify$/i) ||
    lowerCmd.match(/^spotify\s+par\s+(.+?)\s+(?:chalao|bajaao)$/i);
  if (spotifyMatch) {
    const query = spotifyMatch[1].trim();
    const launchConfig = getSpotifyLaunchConfig(query);
    return {
      action: `जी मालिक, स्पॉटिफाई पर "${query}" खोज देलीं!`,
      url: launchConfig.webUrl,
      appLaunchConfig: launchConfig,
      isBrowserAction: true,
      type: "spotify",
    };
  }

  // 5. Screen analysis command intent
  if (
    lowerCmd.includes("screen dekho") ||
    lowerCmd.includes("check screen") ||
    lowerCmd.includes("what is on my screen") ||
    lowerCmd.includes("screen padho") ||
    lowerCmd.includes("view screen") ||
    lowerCmd.includes("screen share")
  ) {
    return {
      action: "जी मालिक, हम राउर स्क्रीन विज़न देख रहल बानी अउरी सब गतिविधि पर नज़र रखले बानी!",
      isBrowserAction: false,
      type: "screen",
    };
  }

  // 6. Generic "Open [App Name]" / "Khol [App Name]" / "[App Name] khol" for ANY app!
  const genericOpenMatch =
    lowerCmd.match(/^(?:open|launch|start)\s+(?:the\s+)?(.+?)(?:\s+app)?$/i) ||
    lowerCmd.match(/^(?:khol|kholo|chalu\s+kara)\s+(?:the\s+)?(.+?)(?:\s+app)?$/i) ||
    lowerCmd.match(/^(.+?)\s+(?:app\s+)?(?:khol|kholo|open\s+kar|open\s+kara|chalu\s+kar)$/i);

  if (genericOpenMatch) {
    const targetAppName = genericOpenMatch[1].trim();
    const launchConfig = getGenericAppLaunchConfig(targetAppName);
    return {
      action: `जी मालिक, ${launchConfig.name} ऐप खोल देलीं! अगर मोबाइल में ऐप इनस्टॉल बा त सीधे ऐप खुली, ना त ऑफिशियल वेबसाइट खुल जाई।`,
      url: launchConfig.webUrl,
      appLaunchConfig: launchConfig,
      isBrowserAction: true,
      type: "navigation",
    };
  }

  // 7. Single word app commands (e.g. "whatsapp", "instagram", "youtube", "chatgpt", "gemini", "claude")
  const singleAppAliases = [
    "whatsapp",
    "instagram",
    "youtube",
    "facebook",
    "telegram",
    "spotify",
    "chatgpt",
    "gemini",
    "claude",
    "twitter",
    "snapchat",
    "reddit",
    "linkedin",
    "netflix",
    "gmail",
    "maps",
    "discord",
    "github",
    "amazon",
    "flipkart",
    "pinterest",
    "tiktok",
    "zoom",
    "uber",
    "zomato",
    "swiggy",
    "phonepe",
    "paytm",
    "notion",
    "duolingo",
  ];

  if (singleAppAliases.includes(lowerCmd)) {
    const launchConfig = getGenericAppLaunchConfig(lowerCmd);
    return {
      action: `जी मालिक, ${launchConfig.name} ऐप खोल देलीं! अगर ऐप इनस्टॉल बा त सीधे ऐप खुली, ना त ऑफिशियल वेबसाइट खुल जाई।`,
      url: launchConfig.webUrl,
      appLaunchConfig: launchConfig,
      isBrowserAction: true,
      type: "navigation",
    };
  }

  return { action: "", isBrowserAction: false };
}
