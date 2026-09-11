import { GoogleGenerativeAI } from "@google/generative-ai";
import { randomUUID } from "crypto";
import { TRANSACTION_EXTRACTION_PROMPT } from "@/lib/prompts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);



export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return Response.json({ error: "No audio file provided" }, { status: 400 });
    }

    // 1. Transcribe with Sunbird
    const sunbirdForm = new FormData();
    sunbirdForm.append("audio", audioFile);
    sunbirdForm.append("language", "lug");
    sunbirdForm.append("adapter", "lug");

    const sttResponse = await fetch("https://api.sunbird.ai/tasks/stt", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.SUNBIRD_API_KEY}` },
      body: sunbirdForm,
    });

    if (!sttResponse.ok) {
      const errText = await sttResponse.text();
      return Response.json(
        { error: "Sunbird STT request failed", detail: errText },
        { status: 502 }
      );
    }

    const { audio_transcription } = await sttResponse.json();

    // 2. Extract structured JSON with Gemini (free tier)
    const todayISO = new Date().toISOString().split("T")[0];
    const systemPrompt = TRANSACTION_EXTRACTION_PROMPT.replace(
      "{{CURRENT_DATE}}",
      todayISO
    );

    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-pro",
      systemInstruction: systemPrompt,
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(audio_transcription);
    const text = result.response.text();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return Response.json(
        { error: "Model returned invalid JSON", raw: text },
        { status: 502 }
      );
    }

    parsed.transaction_id = randomUUID();
    parsed.vendor_id = "vendor_001";
    parsed.timestamp = new Date().toISOString();
    parsed.raw_transcript = audio_transcription;

    return Response.json(parsed);
  } catch (err) {
    console.error("extract-transaction error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}