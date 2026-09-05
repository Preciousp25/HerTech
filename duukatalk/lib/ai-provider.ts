import { Transaction, validateTransaction } from "./schema";

export interface TranscriptionResult {
  transcript: string;
  transaction: Transaction;
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
 */
const EXTRACTION_PROMPT = `
You are an assistant helping market vendors record sales and credit transactions.

You will receive a transcript of a market vendor describing a transaction.
The transcript may contain English, Luganda, Swahili, or a mixture of these languages.

Extract the transaction details into EXACTLY this JSON structure:

{
  "item": string,
  "quantity": number,
  "unit": string or null,
  "unitPrice": number,
  "customerName": string or null,
  "paymentType": "cash" or "credit",
  "dueDate": string or null
}

Rules:

1. "item" is the product being sold.
2. "quantity" is the number of items/units sold.
3. "unit" describes the unit, for example:
   "kg", "piece", "pieces", "bag", "box", "litre".
   Use null if it was not mentioned.
4. "unitPrice" is the price for one unit.
5. "customerName" is the customer's name if mentioned. Otherwise use null.
6. "paymentType" must be exactly "cash" or "credit".
7. "dueDate" must be an ISO date such as "2026-09-15" if a credit payment date was mentioned.
8. If the transaction is cash, "dueDate" must be null.
9. If a required value cannot be determined from the transcript, do not invent it.
10. Return ONLY valid JSON.
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
`;

/**
 * Sunbird AI provider.
 *
 * The process happens in two stages:
 *
 * 1. Sunbird Speech-to-Text converts the audio into text.
 * 2. Sunflower extracts structured transaction information from the transcript.
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

    const transaction = await this.extractTransaction(transcript);

    return {
      transcript,
      transaction,
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
  ): Promise<Transaction> {
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

    return parseTransactionJson(rawContent);
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
 * Parse the JSON returned by Sunflower.
 */
function parseTransactionJson(
  rawContent: string
): Transaction {
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

  return validateTransaction(parsed);
}

/**
 * Remove Markdown code fences only when they surround
 * the complete response.
 *
 * This is safer than globally replacing every ``` occurrence.
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