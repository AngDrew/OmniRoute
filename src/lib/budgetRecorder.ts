/**
 * Budget Usage Recording — Helper functions for recording budget usage
 *
 * Provides a unified way to record budget usage across all API endpoints.
 * Handles deduplication and graceful degradation.
 *
 * @module lib/budgetRecorder
 */

import { recordBudgetUsage } from "./db/apiKeyBudgetLedger";

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
