import { NextRequest, NextResponse } from "next/server";
import { collection, doc, setDoc } from "firebase/firestore";
import { getAiProvider } from "@/lib/ai-provider";
import {
  VoiceToJsonResponse,
  getMissingRequiredFields,
  toTransaction,
} from "@/lib/schema";
import { db } from "@/lib/firebase";
import { toFirestoreTransaction } from "@/lib/firestore-transaction";

export const runtime = "nodejs";

const AUTH_COOKIE_NAME = "duukatalk_vendor_id";
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const TRANSACTIONS_COLLECTION = "transactions";

export async function POST(
  request: NextRequest
): Promise<NextResponse<VoiceToJsonResponse>> {
  // --------------------------------------------------
  // 1. Get the authenticated vendor ID
  // --------------------------------------------------

  const vendorId = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!vendorId) {
    return NextResponse.json(
      {
        success: false,
        error: "Not authenticated",
      },
      { status: 401 }
    );
  }

  // --------------------------------------------------
  // 2. Read form data
  // --------------------------------------------------

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Request must be multipart/form-data",
      },
      { status: 400 }
    );
  }

  const audioEntry = formData.get("audio");

  if (!audioEntry || !(audioEntry instanceof File)) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing 'audio' file in form data",
      },
      { status: 400 }
    );
  }

  // --------------------------------------------------
  // 3. Validate audio file
  // --------------------------------------------------

  if (audioEntry.size === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "Audio file is empty",
      },
      { status: 400 }
    );
  }

  if (audioEntry.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Audio file exceeds maximum allowed size (50MB)",
      },
      { status: 400 }
    );
  }

  const mimeType = audioEntry.type || "audio/webm";

  // --------------------------------------------------
  // 4. Convert audio to a Buffer
  // --------------------------------------------------

  let audioBuffer: Buffer;

  try {
    const arrayBuffer = await audioEntry.arrayBuffer();
    audioBuffer = Buffer.from(arrayBuffer);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to read audio file",
      },
      { status: 400 }
    );
  }

  // --------------------------------------------------
  // 5. Process the audio with the AI provider
  // --------------------------------------------------

  try {
    console.info("Processing transaction for vendor:", vendorId);

    const provider = getAiProvider();

    const result = await provider.processAudio(
      audioBuffer,
      mimeType
    );

    // --------------------------------------------------
    // 6. Check for missing transaction fields
    // --------------------------------------------------

    const missingFields = getMissingRequiredFields(
      result.extracted
    );

    // If the AI could not extract enough information,
    // return the result so the frontend can ask the
    // vendor to clarify the transaction.
    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: true,
          needsClarification: true,
          transcript: result.transcript,
          extracted: result.extracted,
          missingFields,
        },
        { status: 200 }
      );
    }

    // --------------------------------------------------
    // 7. Create server-side timestamp
    // --------------------------------------------------

    const timestamp = new Date().toISOString();

    const transaction = toTransaction(
      result.extracted,
      timestamp
    );

    // --------------------------------------------------
    // 8. Create Firestore document reference
    // --------------------------------------------------

    const docRef = doc(
      collection(db, TRANSACTIONS_COLLECTION)
    );

    // --------------------------------------------------
    // 9. Convert to Firestore format
    //    and attach the authenticated vendor ID
    // --------------------------------------------------

    const firestoreTransaction =
      toFirestoreTransaction(
        transaction,
        result.transcript,
        docRef.id,
        vendorId
      );

    // --------------------------------------------------
    // 10. Save transaction to Firestore
    // --------------------------------------------------

    await setDoc(docRef, firestoreTransaction);

    console.info("Transaction saved successfully:", {
      transactionId: docRef.id,
      vendorId,
    });

    // --------------------------------------------------
    // 11. Return successful response
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        transcript: result.transcript,
        transaction,
        transactionId: docRef.id,
      },
      { status: 200 }
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Unknown error during processing";

    console.error("voice-to-json error:", message);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 502 }
    );
  }
}