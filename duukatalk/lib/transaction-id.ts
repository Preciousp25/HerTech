import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

const COUNTER_PATH = ["metadata", "transaction_counter"] as const;

export async function getNextTransactionId(): Promise<string> {
  const counterRef = doc(db, ...COUNTER_PATH);

  const nextNumber = await runTransaction(db, async (transaction) => {
    const counterSnapshot = await transaction.get(counterRef);
    const storedNumber = Number(counterSnapshot.data()?.lastNumber) || 0;
    const next = storedNumber + 1;

    transaction.set(counterRef, { lastNumber: next }, { merge: true });
    return next;
  });

  return `txn_${String(nextNumber).padStart(3, "0")}`;
}
