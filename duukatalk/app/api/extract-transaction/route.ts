import { GoogleGenerativeAI } from "@google/generative-ai";
import { randomUUID } from "crypto";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT_TEMPLATE = `You are a transaction extraction engine for duukatalk, a voice-first ledger
for market vendors in Uganda. Vendors speak transactions naturally, often
mixing Luganda and English in the same sentence (e.g. "Nakato yagula 2kg
z'omuceere, alisasula Friday"). Your job is to listen to what was said and
convert it into exactly one JSON object — nothing else.

Return ONLY valid JSON matching this exact shape. No markdown, no code
fences, no explanation before or after it:

{
  "transaction_id": null,
  "vendor_id": null,
  "type": "sale | credit | stock_update",
  "item": "string",
  "quantity": number,
  "unit": "string or null",
  "unit_price": number or null,
  "total_amount": number or null,
  "customer_name": "string or null",
  "payment_type": "cash | credit",
  "due_date": "ISO date string or null",
  "timestamp": null,
  "raw_transcript": "string — the exact words spoken, transcribed as-is",
  "confidence_flag": true or false
}

Rules for filling each field:

- transaction_id, vendor_id, timestamp: always return null. These are
  filled by the server, not by you.
- type: "sale" for a straightforward cash transaction, "credit" if any
  form of lending, owing, or future payment is mentioned, "stock_update"
  if the vendor is describing receiving or adding stock rather than
  selling it.
- item: the product mentioned, in singular form, translated to English
  if spoken in Luganda (e.g. "omuceere" -> "rice").
- quantity: the numeric amount only, as a number, not a string.
- unit: the unit of measurement if stated (kg, litres, pieces, bags). If
  no unit is stated, return null — do not guess one.
- unit_price: the price per unit if stated. If only a total price is
  given, leave unit_price as null and put the value in total_amount
  instead.
- total_amount: if both quantity and unit_price are present, compute
  quantity * unit_price. If a total was spoken directly instead, use
  that number. If neither can be determined, return null.
- customer_name: required whenever type is "credit". If type is "credit"
  and no name was mentioned, still return null for this field, but set
  confidence_flag to true.
- payment_type: "credit" if the vendor mentions lending, owing, paying
  later, or a future date. Otherwise "cash". For "stock_update"
  transactions, default payment_type to "cash" unless the vendor
  explicitly says the stock was bought on credit.
- All monetary amounts (unit_price, total_amount) are in Ugandan
  Shillings (UGX) unless another currency is explicitly stated.
- due_date: only relevant when payment_type is "credit". Convert relative
  phrases ("Friday", "next week", "in two days") into an ISO date
  assuming today's date is provided to you in the prompt context. If no
  timeframe was mentioned, return null.
- raw_transcript: transcribe exactly what was said, preserving the
  original language mix. Do not translate this field.
- confidence_flag: set to true if you had to guess, infer, or leave any
  field null that would normally be expected for that transaction type
  (e.g. a credit transaction with no customer name, or a sale with no
  price at all). Set to false only when every relevant field was clearly
  stated.

Never fabricate a value. If something wasn't said, use null and let
confidence_flag communicate the uncertainty — a human will review flagged
transactions.

Today's date is: {{CURRENT_DATE}}`;

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
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace(
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