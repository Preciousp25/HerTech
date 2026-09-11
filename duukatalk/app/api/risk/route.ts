import { NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const CREDIT_LIMIT = 15000;
const LARGE_QUANTITY_THRESHOLD = 20;

type Transaction = {
	payment_type?: string;
	customer_name?: string;
	total_amount?: number | string;
	quantity?: number | string;
	product_name?: string;
};

export async function GET() {
	try {
		const snapshot = await getDocs(collection(db, "transactions"));
		const transactions = snapshot.docs.map((doc) => doc.data() as Transaction);
		const flags: {
			type: string;
			message: string;
			details: Record<string, unknown>;
		}[] = [];

		const creditTotals: Record<string, number> = {};
		for (const transaction of transactions) {
			if (transaction.payment_type?.toLowerCase() === "credit") {
				const customer = transaction.customer_name || "Unknown";
				const amount = Number(transaction.total_amount) || 0;
				creditTotals[customer] = (creditTotals[customer] || 0) + amount;
			}
		}

		for (const [customer, total] of Object.entries(creditTotals)) {
			if (total > CREDIT_LIMIT) {
				flags.push({
					type: "credit_limit",
					message: `${customer} has exceeded the credit limit`,
					details: { customer, total, limit: CREDIT_LIMIT },
				});
			}
		}

		transactions.forEach((transaction, index) => {
			const quantity = Number(transaction.quantity) || 0;
			if (quantity > LARGE_QUANTITY_THRESHOLD) {
				flags.push({
					type: "large_quantity",
					message: `Large quantity movement detected${transaction.product_name ? ` for ${transaction.product_name}` : ""}`,
					details: {
						transactionIndex: index,
						product: transaction.product_name || "Unknown",
						quantity,
					},
				});
			}
		});

		return NextResponse.json({ flags, count: flags.length });
	} catch (error) {
		console.error("Risk analysis failed:", error);
		return NextResponse.json(
			{ error: "Unable to analyze transaction risks" },
			{ status: 500 },
		);
	}
}
