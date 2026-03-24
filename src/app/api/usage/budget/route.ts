import { NextResponse } from "next/server";
import { getApiKeys, getBudgetUsageSummary, evaluateBudget } from "@/lib/localDb";

/**
 * GET /api/usage/budget
 *
 * Returns budget information for all API keys.
 * Includes current usage and limits for each key.
 */
export async function GET() {
  try {
    const keys = await getApiKeys();

    const keysWithBudget = keys.map((key) => {
      const budgetData = key.budgetMetric
        ? {
            metric: key.budgetMetric,
            limits: {
              daily: key.budgetDailyLimit ?? null,
              weekly: key.budgetWeeklyLimit ?? null,
              monthly: key.budgetMonthlyLimit ?? null,
            },
            usage: getBudgetUsageSummary(key.id, key.budgetMetric),
            blocked: evaluateBudget(
              key.id,
              key.budgetMetric,
              {
                daily: key.budgetDailyLimit ?? null,
                weekly: key.budgetWeeklyLimit ?? null,
                monthly: key.budgetMonthlyLimit ?? null,
              },
              1
            ).blocked,
          }
        : null;

      return {
        id: key.id,
        name: key.name,
        budget: budgetData,
      };
    });

    return NextResponse.json({ keys: keysWithBudget });
  } catch (error) {
    console.error("Error fetching budget summary:", error);
    return NextResponse.json({ error: "Failed to fetch budget summary" }, { status: 500 });
  }
}
