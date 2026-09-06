import { NextRequest, NextResponse } from "next/server";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { getNextTransactionId } from "../../../lib/transaction-id";

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, "transactions"));
    const transactions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
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
    const body = await request.json();
    const customerName = String(body.customer_name || "").trim();
    const item = String(body.item || "").trim();
    const totalAmount = Number(body.total_amount);
    const paymentType = body.payment_type === "credit" ? "credit" : "cash";

    if (!customerName || !item || !Number.isFinite(totalAmount) || totalAmount <= 0) {
      return NextResponse.json(
        { error: "customer_name, item, and a positive total_amount are required" },
        { status: 400 },
      );
    }

    const transactionId = await getNextTransactionId();
    const transactionRef = doc(db, "transactions", transactionId);
    const transaction = {
      transaction_id: transactionId,
      customer_name: customerName,
      item,
      total_amount: totalAmount,
      payment_type: paymentType,
      type: paymentType === "cash" ? "sale" : "credit",
      timestamp: new Date().toISOString(),
    };

    await setDoc(transactionRef, transaction);
    return NextResponse.json({ id: transactionId, ...transaction }, { status: 201 });
  } catch (error) {
    console.error("Error saving ledger transaction:", error);
    return NextResponse.json({ error: "Failed to save transaction" }, { status: 500 });
  }
}