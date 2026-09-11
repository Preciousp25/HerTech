import { CREDIT_LIMIT, LARGE_QUANTITY_THRESHOLD, isOutstandingCredit } from "./credit";

export type Language = "EN" | "LUG" | "MIX";

export type RiskFlagType = "credit_risk" | "stock_movement" | "due_date" | "cash_vs_credit";

export type RiskFlag = {
  id: string;
  type: RiskFlagType;
  severity: "warning" | "critical";
  message: string;
  details: Record<string, unknown>;
};

export type RiskTransaction = {
  transaction_id?: string;
  payment_type?: string;
  customer_name?: string | null;
  total_amount?: number | string;
  quantity?: number | string;
  item?: string;
  due_date?: string | null;
  timestamp?: string;
  settled?: boolean;
};

export function localize(language: Language, english: string, luganda: string): string {
  if (language === "EN") return english;
  if (language === "LUG") return luganda;
  return `${english} · ${luganda}`;
}

export function parseLanguage(value: string | null | undefined): Language {
  if (value === "EN" || value === "LUG" || value === "MIX") return value;
  return "EN";
}

export function evaluateRiskFlags(
  transactions: RiskTransaction[],
  language: Language = "EN",
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const today = new Date().toISOString().split("T")[0];

  const creditTotals: Record<string, number> = {};
  for (const txn of transactions) {
    if (isOutstandingCredit(txn)) {
      const name = txn.customer_name || "Unknown";
      const amount = Number(txn.total_amount) || 0;
      creditTotals[name] = (creditTotals[name] || 0) + amount;
    }
  }
  for (const [name, total] of Object.entries(creditTotals)) {
    if (total > CREDIT_LIMIT) {
      flags.push({
        id: `credit_${name}`,
        type: "credit_risk",
        severity: total > CREDIT_LIMIT * 1.5 ? "critical" : "warning",
        message: localize(
          language,
          `${name} now owes UGX ${total.toLocaleString()}, over the ${CREDIT_LIMIT.toLocaleString()} limit`,
          `${name} kati alina omubanja gwa UGX ${total.toLocaleString()}, gusukkiridde ekkomo lya UGX ${CREDIT_LIMIT.toLocaleString()}`,
        ),
        details: { customerName: name, amountOwed: total, limit: CREDIT_LIMIT },
      });
    }
  }

  for (const txn of transactions) {
    const quantity = Number(txn.quantity) || 0;
    if (quantity > LARGE_QUANTITY_THRESHOLD) {
      flags.push({
        id: `stock_${txn.transaction_id}`,
        type: "stock_movement",
        severity: "warning",
        message: localize(
          language,
          `Unusually large quantity recorded for ${txn.item} (${quantity})`,
          `Omuwendo omunene ogutali bulijjo gulabiddwa ku ${txn.item} (${quantity})`,
        ),
        details: {
          item: txn.item,
          quantity,
          threshold: LARGE_QUANTITY_THRESHOLD,
          transactionId: txn.transaction_id,
        },
      });
    }
  }

  for (const txn of transactions) {
    if (!isOutstandingCredit(txn)) continue;
    if (!txn.due_date || txn.due_date === "N/A") continue;

    const dueDay = txn.due_date.slice(0, 10);
    if (dueDay <= today) {
      flags.push({
        id: `due_${txn.transaction_id}`,
        type: "due_date",
        severity: dueDay < today ? "critical" : "warning",
        message: localize(
          language,
          `${txn.customer_name}'s payment for ${txn.item} was due ${txn.due_date}`,
          `Okusasula kwa ${txn.customer_name} ku ${txn.item} kwali kutuuse ${txn.due_date}`,
        ),
        details: {
          customerName: txn.customer_name,
          item: txn.item,
          dueDate: txn.due_date,
          amount: Number(txn.total_amount) || 0,
        },
      });
    }
  }

  let totalCash = 0;
  let totalCredit = 0;
  for (const txn of transactions) {
    const amount = Number(txn.total_amount) || 0;
    if ((txn.payment_type || "").toLowerCase() === "cash" || txn.settled === true) {
      totalCash += amount;
    }
    if (isOutstandingCredit(txn)) totalCredit += amount;
  }
  if (totalCredit > totalCash) {
    flags.push({
      id: "shop_cash_vs_credit",
      type: "cash_vs_credit",
      severity: "critical",
      message: localize(
        language,
        `Outstanding credit (UGX ${totalCredit.toLocaleString()}) exceeds cash at hand (UGX ${totalCash.toLocaleString()})`,
        `Amabanja agasigadde (UGX ${totalCredit.toLocaleString()}) gasukkiridde ssente eziriwo (UGX ${totalCash.toLocaleString()})`,
      ),
      details: { totalCash, totalCredit },
    });
  }

  return flags;
}

export function alertFingerprint(flag: RiskFlag): string {
  switch (flag.type) {
    case "credit_risk":
      return String(flag.details.amountOwed ?? flag.message);
    case "due_date":
      return `${flag.details.dueDate ?? ""}:${new Date().toISOString().split("T")[0]}`;
    case "stock_movement":
      return String(flag.details.transactionId ?? flag.id);
    case "cash_vs_credit":
      return `${flag.details.totalCash}:${flag.details.totalCredit}`;
    default:
      return flag.message;
  }
}
