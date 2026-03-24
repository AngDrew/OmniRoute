/**
 * Budget Usage Recording — Helper functions for recording budget usage
 *
 * Provides a unified way to record budget usage across all API endpoints.
 * Handles deduplication and graceful degradation.
 *
 * @module lib/budgetRecorder
 */

import { recordBudgetUsage } from "./db/apiKeyBudgetLedger";
import { saveRequestUsage } from "./usageDb";

interface BudgetRecordOptions {
  apiKeyId: string;
  endpointType: string;
  provider?: string | null;
  model?: string | null;
  success?: boolean;
  costUsd?: number | null;
  costSource?: string | null;
  requestCount?: number;
}

interface UsageRecordOptions extends BudgetRecordOptions {
  latencyMs?: number;
  tokens?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheCreation?: number;
    reasoning?: number;
  };
  status?: string;
  apiKeyName?: string | null;
}

/**
 * Record budget usage for an API request.
 * Should be called after successful request completion.
 */
export function recordApiBudgetUsage(options: BudgetRecordOptions): void {
  if (!options.apiKeyId) return;

  try {
    recordBudgetUsage({
      apiKeyId: options.apiKeyId,
      endpointType: options.endpointType,
      provider: options.provider ?? null,
      model: options.model ?? null,
      success: options.success !== false,
      requestCount: options.requestCount ?? 1,
      costUsd: options.costUsd ?? null,
      costSource: options.costSource ?? "unknown",
    });
  } catch (error) {
    // Non-critical: don't fail the request if budget recording fails
    console.error("[BudgetRecorder] Failed to record usage:", error);
  }
}

/**
 * Record both budget usage and analytics usage for an API request.
 * This ensures data appears in both budget tracking AND analytics dashboard.
 * Should be called after successful request completion.
 */
export async function recordUsageWithAnalytics(options: UsageRecordOptions): Promise<void> {
  // Always record budget usage (if apiKeyId provided)
  if (options.apiKeyId) {
    try {
      recordBudgetUsage({
        apiKeyId: options.apiKeyId,
        endpointType: options.endpointType,
        provider: options.provider ?? null,
        model: options.model ?? null,
        success: options.success !== false,
        requestCount: options.requestCount ?? 1,
        costUsd: options.costUsd ?? null,
        costSource: options.costSource ?? "unknown",
      });
    } catch (error) {
      console.error("[BudgetRecorder] Failed to record budget usage:", error);
    }
  }

  // Always record analytics usage (for all requests)
  try {
    await saveRequestUsage({
      provider: options.provider || "unknown",
      model: options.model || "unknown",
      tokens: {
        input: options.tokens?.input ?? 0,
        output: options.tokens?.output ?? 0,
        cacheRead: options.tokens?.cacheRead ?? 0,
        cacheCreation: options.tokens?.cacheCreation ?? 0,
        reasoning: options.tokens?.reasoning ?? 0,
      },
      status: options.status || "200",
      success: options.success !== false,
      latencyMs: options.latencyMs ?? 0,
      timeToFirstTokenMs: options.latencyMs ?? 0,
      errorCode: null,
      timestamp: new Date().toISOString(),
      apiKeyId: options.apiKeyId || undefined,
      apiKeyName: options.apiKeyName || undefined,
    });
  } catch (error) {
    console.error("[BudgetRecorder] Failed to save analytics usage:", error);
  }
}

/**
 * Extract cost from token usage based on provider pricing.
 * Returns null if cost cannot be determined.
 */
export function calculateRequestCost(
  provider: string,
  model: string,
  tokens: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheCreation?: number;
    reasoning?: number;
  }
): number | null {
  // This is a placeholder - in production, this should use the pricing data
  // from src/lib/usage/costCalculator.ts
  // For now, return null to indicate unknown cost
  return null;
}
