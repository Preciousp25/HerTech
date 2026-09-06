import { ExtractedFields, validateExtractedFields } from "./schema";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface TranscriptionResult {
  transcript: string;
  extracted: ExtractedFields;
}

export interface AiProvider {
  processAudio(
    audioBuffer: Buffer,
    mimeType: string
  ): Promise<TranscriptionResult>;
}

/**
 * Sunbird AI API endpoints
 */
const SUNBIRD_STT_URL =
  "https://api.sunbird.ai/tasks/audio/transcriptions";

const SUNBIRD_CHAT_URL =
  "https://api.sunbird.ai/tasks/chat/completions";

/**
 * Prompt used by Sunflower to extract transaction information
 * from the transcript returned by Sunbird Speech-to-Text.
 *
 * Every field is nullable so the model always has a valid JSON shape
 * to return, even when the transcript is ambiguous, incomplete, or
 * not a transaction at all. Completeness is checked afterwards by
 * getMissingRequiredFields() in schema.ts, not by the model.
 */
const EXTRACTION_PROMPT = `
You are an assistant helping market vendors record sales and credit transactions.

You will receive a transcript of a market vendor describing a transaction.
The transcript may contain English, Luganda, Swahili, or a mixture of these languages.

Extract the transaction details into EXACTLY this JSON structure:

{
  "item": null,
  "quantity": null,
  "unit": null,
  "unitPrice": null,
  "customerName": null,
  "paymentType": null,
  "dueDate": null
}

Rules:

1. "item" is the product being sold.
2. "quantity" is the number of items/units sold.
3. "unit" describes the unit, for example:
   "kg", "piece", "pieces", "bag", "box", "litre".
   Use null if it was not mentioned.
4. "unitPrice" is the price for one unit.
5. "customerName" is the customer's name if mentioned. Otherwise use null.
6. "paymentType" must be exactly "cash" or "credit" if it can be determined from the transcript.
7. "dueDate" must be an ISO date such as "2026-09-15" if a credit payment date was mentioned.
8. If the transaction is cash, "dueDate" must be null.
9. If a value cannot be determined from the transcript, set it to null. Do not invent it.
10. Your entire response must ALWAYS be exactly one JSON object matching this structure —
    even if the transcript is unclear, incomplete, unrelated to a transaction, or contains
    no usable information at all. In that case, set every field to null. NEVER respond with
    a sentence, apology, or explanation instead of JSON, under any circumstances.
11. Do not use Markdown code fences.
12. Do not add explanations before or after the JSON.

Example:

{
  "item": "tomatoes",
  "quantity": 5,
  "unit": "kg",
  "unitPrice": 3000,
  "customerName": "Sarah",
  "paymentType": "credit",
  "dueDate": "2026-09-15"
}

Example when information is missing:

{
  "item": "sugar",
  "quantity": 2,
  "unit": "kg",
  "unitPrice": null,
  "customerName": null,
  "paymentType": "credit",
  "dueDate": "2026-09-11"
}
`;

/**
 * Sunbird AI provider.
 *
 * The process happens in two stages:
 *
 * 1. Sunbird Speech-to-Text converts the audio into text.
 * 2. Sunflower extracts structured transaction fields from the transcript.
 *    These fields may be incomplete — the caller decides what to do
 *    with a partial extraction.
 */
class SunbirdProvider implements AiProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async processAudio(
    audioBuffer: Buffer,
    mimeType: string
  ): Promise<TranscriptionResult> {
    const transcript = await this.transcribeAudio(
      audioBuffer,
      mimeType
    );

    const extracted = await this.extractTransaction(transcript);

    return {
      transcript,
      extracted,
    };
  }

  /**
   * Send audio to Sunbird Speech-to-Text.
   */
  private async transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string
  ): Promise<string> {
    /**
     * Sunbird requires a language.
     *
     * For now we use SUNBIRD_LANGUAGE from .env.local.
     * Example:
     *
     * SUNBIRD_LANGUAGE=eng
     *
     * You can later allow the user to select Luganda, English,
     * Swahili, etc. from the application.
     */
    const language =
      process.env.SUNBIRD_LANGUAGE?.trim() || "eng";

    const formData = new FormData();

    const arrayBuffer = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength
    ) as ArrayBuffer;

    const audioBlob = new Blob([arrayBuffer], {
      type: mimeType,
    });

    formData.append(
      "audio",
      audioBlob,
      this.getFileName(mimeType)
    );

    formData.append("language", language);

    const response = await fetch(SUNBIRD_STT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "Sunbird Speech-to-Text error:",
        response.status,
        errorText
      );

      throw new Error(
        `Sunbird Speech-to-Text request failed with status ${response.status}`
      );
    }

    const data: unknown = await response.json();

    const transcript = this.extractTranscript(data);

    if (!transcript) {
      throw new Error(
        "Sunbird Speech-to-Text returned an empty transcript"
      );
    }

    return transcript;
  }

  /**
   * Send the transcript to Sunflower for transaction extraction.
   */
  private async extractTransaction(
    transcript: string
  ): Promise<ExtractedFields> {
    const response = await fetch(SUNBIRD_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: "sunflower-14b",
        messages: [
          {
            role: "system",
            content: EXTRACTION_PROMPT,
          },
          {
            role: "user",
            content: transcript,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "Sunbird Sunflower error:",
        response.status,
        errorText
      );

      throw new Error(
        `Sunbird transaction extraction failed with status ${response.status}`
      );
    }

    const data: unknown = await response.json();

    const rawContent = this.extractChatContent(data);

    if (!rawContent) {
      throw new Error(
        "Sunflower returned an empty response"
      );
    }

    try {
      return parseExtractedFields(rawContent);
    } catch (error) {
      if (!process.env.GEMINI_API_KEY) {
        throw error;
      }

      console.warn(
        "Sunflower did not return structured JSON; retrying extraction with Gemini"
      );
      return this.extractWithGemini(transcript);
    }
  }

  private async extractWithGemini(
    transcript: string
  ): Promise<ExtractedFields> {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: `${EXTRACTION_PROMPT}\nToday's date is ${new Date().toISOString().slice(0, 10)}.`,
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(transcript);
    const rawContent = result.response.text();

    console.info("Gemini extraction response", { rawContent });
    return parseExtractedFields(rawContent);
  }

  /**
   * Extract the transcription from Sunbird's response.
   */
  private extractTranscript(data: unknown): string {
    if (!data || typeof data !== "object") {
      throw new Error(
        "Unexpected Sunbird Speech-to-Text response"
      );
    }

    const response = data as Record<string, unknown>;

    /**
     * Sunbird's transcription response uses:
     *
     * audio_transcription
     */
    const transcript = response.audio_transcription;

    if (typeof transcript === "string") {
      return transcript.trim();
    }

    throw new Error(
      "Could not find audio_transcription in Sunbird response"
    );
  }

  /**
   * Extract the assistant's text from the OpenAI-compatible
   * Sunflower chat completion response.
   */
  private extractChatContent(data: unknown): string {
    if (!data || typeof data !== "object") {
      throw new Error(
        "Unexpected Sunflower response"
      );
    }

    const response = data as Record<string, unknown>;

    const choices = response.choices;

    if (!Array.isArray(choices) || choices.length === 0) {
      throw new Error(
        "Sunflower response did not contain choices"
      );
    }

    const firstChoice = choices[0];

    if (
      !firstChoice ||
      typeof firstChoice !== "object"
    ) {
      throw new Error(
        "Unexpected Sunflower choice format"
      );
    }

    const choice = firstChoice as Record<string, unknown>;

    const message = choice.message;

    if (
      !message ||
      typeof message !== "object"
    ) {
      throw new Error(
        "Sunflower response did not contain a message"
      );
    }

    const messageObject =
      message as Record<string, unknown>;

    const content = messageObject.content;

    if (typeof content !== "string") {
      throw new Error(
        "Sunflower response did not contain text content"
      );
    }

    return content.trim();
  }

  /**
   * Generate a filename appropriate for the supplied MIME type.
   */
  private getFileName(mimeType: string): string {
    const normalizedMimeType =
      mimeType.toLowerCase();

    if (normalizedMimeType.includes("wav")) {
      return "recording.wav";
    }

    if (normalizedMimeType.includes("mpeg")) {
      return "recording.mp3";
    }

    if (normalizedMimeType.includes("mp3")) {
      return "recording.mp3";
    }

    if (normalizedMimeType.includes("m4a")) {
      return "recording.m4a";
    }

    if (normalizedMimeType.includes("ogg")) {
      return "recording.ogg";
    }

    if (normalizedMimeType.includes("webm")) {
      return "recording.webm";
    }

    return "recording.audio";
  }
}

/**
 * Parse the JSON returned by Sunflower into ExtractedFields.
 * Throws only for genuinely malformed output (invalid JSON, wrong
 * field types) — legitimately null fields are not an error here.
 */
function parseExtractedFields(
  rawContent: string
): ExtractedFields {
  const cleaned = cleanJsonResponse(rawContent);

  let parsed: unknown;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error(
      "Invalid JSON returned by Sunflower:",
      rawContent
    );

    throw new Error(
      "Sunflower did not return valid transaction JSON"
    );
  }

  return validateExtractedFields(parsed);
}

/**
 * Remove Markdown code fences when they surround the complete response,
 * and fall back to extracting the first {...} block if the model added
 * stray text around the JSON despite instructions not to.
 */
function cleanJsonResponse(
  rawContent: string
): string {
  const trimmed = rawContent.trim();

  const fencedMatch = trimmed.match(
    /^```(?:json)?\s*([\s\S]*?)\s*```$/i
  );

  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const braceMatch = trimmed.match(/\{[\s\S]*\}/);

  if (braceMatch) {
    return braceMatch[0];
  }

  return trimmed;
}

/**
 * Return the configured AI provider.
 *
 * For the current project we use:
 *
 * AI_PROVIDER=sunbird
 *
 * SUNBIRD_API_KEY=your_key_here
 *
 * SUNBIRD_LANGUAGE=eng
 */
export function getAiProvider(): AiProvider {
  const providerName =
    process.env.AI_PROVIDER?.toLowerCase() ||
    "sunbird";

  if (providerName === "sunbird") {
    const key = process.env.SUNBIRD_API_KEY;

    if (!key) {
      throw new Error(
        "SUNBIRD_API_KEY is not configured"
      );
    }

    return new SunbirdProvider(key);
  }

  throw new Error(
    `Unsupported AI_PROVIDER: ${providerName}`
  );
}