import { NextRequest, NextResponse } from "next/server";
import { collection, doc, setDoc } from "firebase/firestore";
import { getAiProvider } from "@/lib/ai-provider";
import { VoiceToJsonResponse } from "@/lib/schema";
import { db } from "@/lib/firebase";
import { toFirestoreTransaction } from "@/lib/firestore-transaction";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const TRANSACTIONS_COLLECTION = "transactions"; // confirm exact name with Sanyu

export async function POST(request: NextRequest): Promise<NextResponse<VoiceToJsonResponse>> {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Request must be multipart/form-data" },
      { status: 400 }
    );
  }

  const audioEntry = formData.get("audio");

  if (!audioEntry || !(audioEntry instanceof File)) {
    return NextResponse.json(
      { success: false, error: "Missing 'audio' file in form data" },
      { status: 400 }
    );
  }

  if (audioEntry.size === 0) {
    return NextResponse.json(
      { success: false, error: "Audio file is empty" },
      { status: 400 }
    );
  }

  if (audioEntry.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { success: false, error: "Audio file exceeds maximum allowed size (50MB)" },
      { status: 400 }
    );
  }

  const mimeType = audioEntry.type || "audio/webm";

  let audioBuffer: Buffer;
  try {
    const arrayBuffer = await audioEntry.arrayBuffer();
    audioBuffer = Buffer.from(arrayBuffer);
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to read audio file" },
      { status: 400 }
    );
  }

  try {
    const provider = getAiProvider();
    const result = await provider.processAudio(audioBuffer, mimeType);

    const docRef = doc(collection(db, TRANSACTIONS_COLLECTION));
    const firestoreTransaction = toFirestoreTransaction(
      result.transaction,
      result.transcript,
      docRef.id
    );

    await setDoc(docRef, firestoreTransaction);

    return NextResponse.json(
      {
        success: true,
        transcript: result.transcript,
        transaction: result.transaction,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during processing";
    console.error("voice-to-json error:", message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 502 }
    );
  }
}