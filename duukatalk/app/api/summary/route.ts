import { NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function GET() {
	try {
		const snapshot = await getDocs(collection(db, "transactions"));
		const transactions = snapshot.docs.map((doc) => doc.data());

		let totalSales = 0;
		let totalCreditOutstanding = 0;
		const perCustomerCredit: Record<string, number> = {};

		for (const txn of transactions) {
			const amount = Number(txn.total_amount) || 0;

			if (txn.payment_type === "cash") {
				totalSales += amount;
			}

			if (txn.payment_type === "credit") {
				totalCreditOutstanding += amount;

				const name = txn.customer_name || "Unknown";
				perCustomerCredit[name] = (perCustomerCredit[name] || 0) + amount;
			}
		}

		return NextResponse.json({
			totalSales,
			totalCreditOutstanding,
			perCustomerCredit,
		});
	} catch (error) {
		console.error("Failed to fetch transaction summary:", error);
		return NextResponse.json(
			{ error: "Failed to fetch transaction summary" },
			{ status: 500 },
		);
	}
}
