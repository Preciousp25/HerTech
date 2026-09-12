import { NextRequest, NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  buildLoanGuidance,
  isOutstandingCredit,
  normalizeCustomerName,
  parseGuidanceLanguage,
} from "@/lib/credit";

export async function GET(request: NextRequest) {
	try {
		const language = parseGuidanceLanguage(request.nextUrl.searchParams.get("language"));
		const snapshot = await getDocs(collection(db, "transactions"));
		const transactions = snapshot.docs.map((doc) => doc.data());

		let totalSales = 0;
		let totalCreditOutstanding = 0;
		const perCustomerCredit: Record<string, number> = {};

		const customerSnapshot = await getDocs(collection(db, "customers"));
		for (const customerDoc of customerSnapshot.docs) {
			const customer = customerDoc.data();
			const profileName = String(customer.customer_name || customerDoc.id || "Unknown");
			const profileKey = normalizeCustomerName(profileName);
			const profileBalance = Number(customer.outstanding_credit || 0);
			if (profileBalance > 0) {
				perCustomerCredit[profileKey] = profileBalance;
			}
		}

		for (const txn of transactions) {
			const amount = Number(txn.total_amount) || 0;

			if (txn.payment_type === "cash" || txn.settled === true) {
				totalSales += amount;
			}

			if (isOutstandingCredit(txn)) {
				totalCreditOutstanding += amount;

				const name = txn.customer_name || "Unknown";
				const key = normalizeCustomerName(name);
				perCustomerCredit[key] = (perCustomerCredit[key] || 0) + amount;
			}
		}

		const guidance = buildLoanGuidance(totalSales, totalCreditOutstanding, language);

		return NextResponse.json({
			totalSales,
			totalCreditOutstanding,
			perCustomerCredit,
			recommendedSavings: guidance.recommendedSavings,
			savingsPercent: guidance.savingsPercent,
			loanReadinessScore: guidance.loanReadinessScore,
			loanAdvice: guidance.loanAdvice,
			creditToSalesRatio: guidance.creditToSalesRatio,
			creditSharePercent: guidance.creditSharePercent,
			shouldStopLending: guidance.shouldStopLending,
		});
	} catch (error) {
		console.error("Failed to fetch transaction summary:", error);
		return NextResponse.json(
			{ error: "Failed to fetch transaction summary" },
			{ status: 500 },
		);
	}
}
