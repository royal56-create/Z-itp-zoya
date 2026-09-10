// screenVisionService.ts - Real-Time Screen Vision, OCR & Error Explanations
import { GoogleGenAI } from "@google/genai";

/**
 * Analyzes the given base64 image (screen capture frame) with Gemini Vision
 */
export async function analyzeScreenContent(
  imageBase64: string,
  userQuery = "What is visible on this screen? Read or explain key elements."
): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Clean base64 prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

    const prompt = `You are Zoya, a brilliant AI voice assistant built by Royal Ankit Ahiran.
The user is sharing their screen and asked: "${userQuery}".
Analyze the image carefully.
1. If the user asks to read the screen ("Ye screen par kya likha hai"), extract and read the main text clearly and naturally in Bhojpuri.
2. If the user asks about an error ("Is error ka matlab kya hai"), explain what the error means in simple, friendly terms and provide a short, actionable fix.
3. If the user asks about a form ("Ye form mein kya bharna hai"), guide them on what fields are present and what to enter.
4. Keep the response spoken, helpful, concise (2-4 sentences max), and delivered in authentic friendly Bhojpuri while crediting developer Royal Ankit Ahiran.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanBase64,
              },
            },
          ],
        },
      ],
    });

    return (
      response.text ||
      "मालिक, हम स्क्रीन देख लेलीं! एह पर जरूरी जानकारी अउरी मेनू देखाई दे रहल बा।"
    );
  } catch (error) {
    console.error("Screen Vision analysis error:", error);
    return "मालिक, स्क्रीन फ्रेम पढ़े में तनी दिक्कत भइल बा। कृपया स्क्रीन शेयर चालू राखीं अउरी दोबारा बोलीं!";
  }
}
