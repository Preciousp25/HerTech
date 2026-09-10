import { NextRequest, NextResponse } from "next/server";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toFirestoreTransaction } from "@/lib/firestore-transaction";
import { notifyAfterTransaction } from "@/lib/notify-transaction";
import { updateCustomerCredit } from "@/lib/updateCustomerCredit";
import { getNextTransactionId } from "@/lib/transaction-id";

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, "transactions"));
    const transactions = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("Error fetching ledger:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      customer?: string;
      customer_name?: string;
      item?: string;
      amount?: number;
      total_amount?: number;
      paymentType?: "cash" | "credit";
      payment_type?: "cash" | "credit";
      dueDate?: string | null;
      phone?: string | null;
    };

    const customer = (body.customer ?? body.customer_name)?.trim();
    const item = body.item?.trim();
    const amount = Number(body.amount ?? body.total_amount);
    const paymentType =
      (body.paymentType ?? body.payment_type) === "credit" ? "credit" : "cash";

    if (!customer || !item || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "customer, item, and a positive amount are required" },
        { status: 400 }
      );
    }

    const transactionId = await getNextTransactionId();
    const timestamp = new Date().toISOString();
    const transactionRef = doc(db, "transactions", transactionId);

    const firestoreTransaction = toFirestoreTransaction(
      {
        item,
        quantity: 1,
        unit: null,
        unitPrice: amount,
        customerName: customer,
        paymentType,
        dueDate: paymentType === "credit" ? (body.dueDate ?? null) : null,
        timestamp,
      },
      "manual entry",
      transactionId
    );

    await setDoc(transactionRef, firestoreTransaction);

    let outstandingCredit: number | undefined;
    if (paymentType === "credit") {
      outstandingCredit = (await updateCustomerCredit(customer)) ?? undefined;
    }

    const sms = await notifyAfterTransaction({
      customerName: customer,
      paymentType,
      item,
      amount,
      quantity: 1,
      dueDate: firestoreTransaction.due_date,
      outstandingCredit,
      customerPhone: body.phone,
    });

    return NextResponse.json(
      { id: transactionId, transaction: firestoreTransaction, sms },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error recording ledger entry:", error);
    return NextResponse.json(
      { error: "Failed to record transaction" },
      { status: 500 }
    );
  }
}