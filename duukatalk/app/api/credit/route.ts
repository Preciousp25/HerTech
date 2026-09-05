import { NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function GET() {
	try {
		const snapshot = await getDocs(collection(db, "transactions"));
		const transactions = snapshot.docs.map((doc) => doc.data());

		const balances: Record<string, { owed: number; dueDates: string[] }> = {};

		for (const txn of transactions) {
			if (txn.payment_type?.toLowerCase() !== "credit") continue;

			const name = txn.customer_name || "Unknown";
			const amount = Number(txn.total_amount) || 0;

			if (!balances[name]) {
				balances[name] = { owed: 0, dueDates: [] };
			}

			balances[name].owed += amount;

			if (txn.due_date && txn.due_date !== "N/A") {
				balances[name].dueDates.push(String(txn.due_date));
			}
		}

		const customers = Object.entries(balances).map(([name, data]) => ({
			customerName: name,
			amountOwed: data.owed,
			dueDates: data.dueDates,
		}));

		return NextResponse.json(customers);
	} catch (error) {
		console.error("Failed to fetch credit balances:", error);
		return NextResponse.json(
			{ error: "Failed to fetch credit balances" },
			{ status: 500 },
		);
	}
}
