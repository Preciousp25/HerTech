import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

const TRANSACTION_ID_PATTERN = /^txn_(\d+)$/;

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

  return `txn_${String(highestNumber + 1).padStart(3, "0")}`;
}
