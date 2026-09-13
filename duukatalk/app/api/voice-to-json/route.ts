import { NextRequest, NextResponse } from "next/server";
import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { getAiProvider } from "@/lib/ai-provider";
import {
  VoiceToJsonResponse,
  getMissingRequiredFields,
  toTransaction,
} from "@/lib/schema";
import { db } from "@/lib/firebase";
import { toFirestoreTransaction } from "@/lib/firestore-transaction";
import { updateCustomerCredit } from "@/lib/updateCustomerCredit";
import { notifyAfterTransaction } from "@/lib/notify-transaction";
import { getNextTransactionId } from "@/lib/transaction-id";
import { CREDIT_LIMIT, normalizeCustomerName } from "@/lib/credit";
import { localize, parseLanguage } from "@/lib/risk-flags";

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
        error: "Audio file exceeds maximum allowed size (50MB)",
      },
      { status: 400 }
    );
  }

  const mimeType = audioEntry.type || "audio/webm";
  const requestedLanguage = parseLanguage(formData.get("language")?.toString() ?? "EN");
  const acknowledgedWarning = formData.get("acknowledgedWarning") === "true";

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

    // Convert the AI-extracted data into the application's
    // standard transaction format.
    const transaction = toTransaction(
      result.extracted,
      timestamp
    );

    if (transaction.paymentType === "credit" && transaction.customerName) {
      const customerKey = `${vendorId}_${normalizeCustomerName(transaction.customerName)}`;
      const customerSnap = await getDoc(doc(db, "customers", customerKey));
      const outstandingCredit = customerSnap.exists()
        ? Number(customerSnap.data().outstanding_credit || 0)
        : 0;

      if (outstandingCredit >= CREDIT_LIMIT && acknowledgedWarning !== true) {
        return NextResponse.json(
          {
            success: false,
            error: localize(
              requestedLanguage,
              `Warning: ${transaction.customerName} already has UGX ${outstandingCredit.toLocaleString()} in outstanding credit, above the UGX ${CREDIT_LIMIT.toLocaleString()} limit. Pause new lending and recover cash first. Use the tick to accept the warning and record, or use the cross to refuse.`,
              `Okulabula: ${transaction.customerName} alina amabanja agasigadde UGX ${outstandingCredit.toLocaleString()}, okusukka ku kkomo lya UGX ${CREDIT_LIMIT.toLocaleString()}. Lekeka okukuza obulava obupya era funya ssente. Kozesa akatikkulu okukkiriza okulabula n'okuwandiika, oba akamukiye okugaana.`,
              `Tahadhari: ${transaction.customerName} tayari ana deni la UGX ${outstandingCredit.toLocaleString()}, lililo juu ya kikomo cha UGX ${CREDIT_LIMIT.toLocaleString()}. Simama kutoa mkopo mpya na kukusanya pesa kwanza. Tumia alama ya tiki kukubali tahadhari na kurekodi, au alama ya x kukataa.`,
              `تحذير: ${transaction.customerName} لديه بالفعل ديون مستحقة قدرها UGX ${outstandingCredit.toLocaleString()}، وهي أعلى من الحد UGX ${CREDIT_LIMIT.toLocaleString()}. أوقف منح القروض الجديدة وابدأ في تحصيل النقد أولاً. استخدم علامة صح للتأكيد أو علامة × للرفض.`,
              `Avertissement : ${transaction.customerName} a déjà un crédit impayé de UGX ${outstandingCredit.toLocaleString()}, au-dessus de la limite de UGX ${CREDIT_LIMIT.toLocaleString()}. Suspendre tout nouveau prêt et récupérer l’argent d’abord. Utilisez la coche pour accepter l’avertissement et enregistrer, ou la croix pour refuser.`,
            ),
          },
          { status: 409 }
        );
      }
    }

    // --------------------------------------------------
    // 8. Generate transaction ID and Firestore reference
    // --------------------------------------------------

    const transactionId = await getNextTransactionId();

    const docRef = doc(
      db,
      TRANSACTIONS_COLLECTION,
      transactionId
    );

    // --------------------------------------------------
    // 9. Convert to Firestore format
    //    and attach the authenticated vendor ID
    // --------------------------------------------------

    const firestoreTransaction = toFirestoreTransaction(
      transaction,
      result.transcript,
      transactionId,
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
    // 11. Update customer credit when necessary
    // --------------------------------------------------

    let outstandingCredit: number | undefined;

    if (
      transaction.paymentType === "credit" &&
      transaction.customerName
    ) {
      outstandingCredit =
        (await updateCustomerCredit(vendorId, transaction.customerName, transaction.totalAmount)) ?? undefined;
    }

    // --------------------------------------------------
    // 12. Send transaction notification asynchronously
    // --------------------------------------------------

    void notifyAfterTransaction({
      customerName: transaction.customerName,
      paymentType: transaction.paymentType,
      item: transaction.item,
      amount: firestoreTransaction.total_amount,
      quantity: transaction.quantity,
      dueDate: transaction.dueDate,
      outstandingCredit,
      language: requestedLanguage,
      vendorId,
    }).catch((error) => {
      console.error("Background notification fan-out failed:", error);
    });

    // --------------------------------------------------
    // 13. Return successful response
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