import { GoogleGenerativeAI } from "@google/generative-ai";

import { QUERY_CLASSIFICATION_PROMPT } from "@/lib/prompts";
import { buildDailySummary } from "@/lib/firestore-transaction";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  const formData = await req.formData();
  const audioFile = formData.get("audio") as File;

  // Step 1: transcribe the question
  const sunbirdForm = new FormData();
  sunbirdForm.append("audio", audioFile);
  sunbirdForm.append("language", "eng"); // start English-only, per your sequencing
  const sttRes = await fetch("https://api.sunbird.ai/tasks/stt", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SUNBIRD_API_KEY}` },
    body: sunbirdForm,
  });

  if (!sttRes.ok) {
    const errText = await sttRes.text();
    return Response.json(
      { error: "Sunbird STT request failed", detail: errText },
      { status: 502 }
    );
  }

  const { audio_transcription: question } = await sttRes.json();

  if (!question || typeof question !== "string" || question.trim() === "") {
    return Response.json(
      { error: "No transcript returned from Sunbird" },
      { status: 502 }
    );
  }

  // Step 2: classify the intent
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" },
  });
  const intentResult = await model.generateContent([QUERY_CLASSIFICATION_PROMPT, question]);
  const intent = JSON.parse(intentResult.response.text());

  // Step 3: build the answer text based on intent
  let answerText = "Sorry, I didn't understand that question.";

  if (intent.query_type === "customer_balance" && intent.customer_name) {
    answerText = "Customer balance queries are coming soon.";
  } else if (intent.query_type === "daily_summary") {
    answerText = await buildDailySummary(new Date().toISOString()); // the function you already built
  } else if (intent.query_type === "stock_level") {
    answerText = "Stock queries are coming soon."; // stub until you wire this up
  }

  // Step 4: speak it back
  const ttsRes = await fetch("https://api.sunbird.ai/tasks/tts", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SUNBIRD_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: answerText, speaker_id: 248, temperature: 0.7 }),
  });
  const { output } = await ttsRes.json();

  return Response.json({ question, answer_text: answerText, audio_url: output.audio_url });
}