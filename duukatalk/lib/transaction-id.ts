import { collection, doc, getDocs, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

const TRANSACTION_ID_PATTERN = /^txn_(\d+)$/;
const COUNTER_PATH = ["metadata", "transaction_counter"] as const;

export async function getNextTransactionId(): Promise<string> {
  const snapshot = await getDocs(collection(db, "transactions"));
  let highestNumber = 0;

  for (const transactionDoc of snapshot.docs) {
    const data = transactionDoc.data();
    const candidateIds = [transactionDoc.id, data.transaction_id];

    for (const candidate of candidateIds) {
      if (typeof candidate !== "string") continue;
      const match = candidate.match(TRANSACTION_ID_PATTERN);
      if (match) highestNumber = Math.max(highestNumber, Number(match[1]));
    }
  }

  const counterRef = doc(db, ...COUNTER_PATH);
  const nextNumber = await runTransaction(db, async (transaction) => {
    const counterSnapshot = await transaction.get(counterRef);
    const storedNumber = Number(counterSnapshot.data()?.lastNumber) || 0;
    const next = Math.max(storedNumber, highestNumber) + 1;

    transaction.set(counterRef, { lastNumber: next }, { merge: true });
    return next;
  });

  return `txn_${String(nextNumber).padStart(3, "0")}`;
}
