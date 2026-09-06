import { Transaction, validateTransaction } from "./schema";

export interface TranscriptionResult {
  transcript: string;
  transaction: Transaction;
}

export interface AiProvider {
  processAudio(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult>;
}

const EXTRACTION_PROMPT = `You will receive an audio recording of a market vendor describing a sale or credit transaction, possibly in a mix of English, Luganda, or Swahili.

First, transcribe the audio exactly as spoken.

Then extract the transaction details into this exact JSON shape, with no extra commentary or markdown:

{
  "item": string,
  "quantity": number,
  "unit": string or null,
  "unitPrice": number,
  "customerName": string or null,
  "paymentType": "cash" or "credit",
  "dueDate": string or null (ISO date, only if payment is on credit and a date was mentioned),
  "timestamp": string (current ISO datetime)
}

Respond ONLY with a JSON object with two top-level fields: "transcript" (the raw transcription) and "transaction" (the object above). No other text.`;

class GeminiProvider implements AiProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async processAudio(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
    const base64Audio = audioBuffer.toString("base64");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: EXTRACTION_PROMPT },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Audio,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const rawContent: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof rawContent !== "string") {
      throw new Error("Unexpected Gemini response shape");
    }

    return parseModelJson(rawContent);
  }
}

function parseModelJson(rawContent: string): TranscriptionResult {
  const cleaned = rawContent.replace(/```json|```/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Model did not return valid JSON");
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.transcript !== "string") {
    throw new Error("Missing 'transcript' in model response");
  }

  const transaction = validateTransaction(obj.transaction);

  return { transcript: obj.transcript, transaction };
}

export function getAiProvider(): AiProvider {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GeminiProvider(key);
}