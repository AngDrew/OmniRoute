/**
 * Budget Ledger — Immutable usage tracking for API key budgets
 *
 * Records every billable/request-budgetable API call in an append-only
 * ledger. Supports both USD and request-count budgets.
 *
 * @module lib/db/apiKeyBudgetLedger
 */

import { getDbInstance } from "./core";
import { v4 as uuidv4 } from "uuid";

type JsonRecord = Record<string, unknown>;

export type BudgetMetric = "usd" | "requests" | null;

export interface BudgetLedgerEntry {
  id: string;
  requestId: string;
  apiKeyId: string;
  timestamp: number;
  endpointType: string;
  provider: string | null;
  model: string | null;
  success: boolean;
  requestCount: number;
  costUsd: number | null;
  costSource: string | null;
}

export interface BudgetUsageSummary {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface BudgetEvaluationResult {
  metric: BudgetMetric;
  limits: {
    daily: number | null;
    weekly: number | null;
    monthly: number | null;
  };
  usage: BudgetUsageSummary;
  blocked: boolean;
  reason: string | null;
}

interface LedgerRow extends JsonRecord {
  id?: unknown;
  request_id?: unknown;
  api_key_id?: unknown;
  timestamp?: unknown;
  endpoint_type?: unknown;
  provider?: unknown;
  model?: unknown;
  success?: unknown;
  request_count?: unknown;
  cost_usd?: unknown;
  cost_source?: unknown;
}

// ──────────────── Window Boundaries (UTC) ────────────────

function getTodayStart(): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today.getTime();
}

function getWeekStart(): number {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
  return weekStart.getTime();
}

function getMonthStart(): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return monthStart.getTime();
}

// ──────────────── Write Operations ────────────────

/**
 * Record a budget usage entry to the ledger.
 * Should be called once per logical API request (after deduplication).
 */
export function recordBudgetUsage(entry: {
  requestId?: string;
  apiKeyId: string;
  endpointType: string;
  provider?: string | null;
  model?: string | null;
  success?: boolean;
  requestCount?: number;
  costUsd?: number | null;
  costSource?: string | null;
}): void {
  const db = getDbInstance();

  const requestId = entry.requestId ?? uuidv4();
  const timestamp = Date.now();

  try {
    db.prepare(
      `
      INSERT INTO api_key_budget_ledger
        (id, request_id, api_key_id, timestamp, endpoint_type, provider, model, success, request_count, cost_usd, cost_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(request_id) DO NOTHING
    `
    ).run(
      uuidv4(),
      requestId,
      entry.apiKeyId,
      timestamp,
      entry.endpointType,
      entry.provider ?? null,
      entry.model ?? null,
      entry.success !== false ? 1 : 0,
      entry.requestCount ?? 1,
      entry.costUsd ?? null,
      entry.costSource ?? null
    );
  } catch (error) {
    console.error("[BudgetLedger] Failed to record usage:", error);
  }
}

// ──────────────── Read Operations ────────────────

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Get total request count for an API key within a time window.
 */
export function getRequestCount(apiKeyId: string, sinceTimestamp: number): number {
  const db = getDbInstance();
  try {
    const row = db
      .prepare(
        "SELECT SUM(request_count) as total FROM api_key_budget_ledger WHERE api_key_id = ? AND timestamp >= ?"
      )
      .get(apiKeyId, sinceTimestamp) as LedgerRow | undefined;
    return toNumber(row?.total, 0);
  } catch (error) {
    console.error("[BudgetLedger] Failed to get request count:", error);
    return 0;
  }
}

/**
 * Get total USD cost for an API key within a time window.
 */
export function getUsdCost(apiKeyId: string, sinceTimestamp: number): number {
  const db = getDbInstance();
  try {
    const row = db
      .prepare(
        "SELECT SUM(cost_usd) as total FROM api_key_budget_ledger WHERE api_key_id = ? AND timestamp >= ? AND cost_usd IS NOT NULL"
      )
      .get(apiKeyId, sinceTimestamp) as LedgerRow | undefined;
    return toNumber(row?.total, 0);
  } catch (error) {
    console.error("[BudgetLedger] Failed to get USD cost:", error);
    return 0;
  }
}

/**
 * Get daily, weekly, and monthly usage for an API key.
 */
export function getBudgetUsageSummary(apiKeyId: string, metric: BudgetMetric): BudgetUsageSummary {
  const todayStart = getTodayStart();
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();

  if (metric === "requests") {
    return {
      daily: getRequestCount(apiKeyId, todayStart),
      weekly: getRequestCount(apiKeyId, weekStart),
      monthly: getRequestCount(apiKeyId, monthStart),
    };
  }

  // metric === "usd" or null (treat as usd)
  return {
    daily: getUsdCost(apiKeyId, todayStart),
    weekly: getUsdCost(apiKeyId, weekStart),
    monthly: getUsdCost(apiKeyId, monthStart),
  };
}

/**
 * Check if an API key has exceeded its budget limits.
 * Returns the full evaluation result including current usage and block status.
 */
export function evaluateBudget(
  apiKeyId: string,
  metric: BudgetMetric,
  limits: { daily: number | null; weekly: number | null; monthly: number | null },
  projectedUsage = 0
): BudgetEvaluationResult {
  const usage = getBudgetUsageSummary(apiKeyId, metric);

  // Evaluate limits
  let blocked = false;
  let reason: string | null = null;

  if (limits.daily !== null && usage.daily + projectedUsage > limits.daily) {
    blocked = true;
    reason = `Daily ${metric === "requests" ? "request" : "budget"} limit exceeded`;
  } else if (limits.weekly !== null && usage.weekly + projectedUsage > limits.weekly) {
    blocked = true;
    reason = `Weekly ${metric === "requests" ? "request" : "budget"} limit exceeded`;
  } else if (limits.monthly !== null && usage.monthly + projectedUsage > limits.monthly) {
    blocked = true;
    reason = `Monthly ${metric === "requests" ? "request" : "budget"} limit exceeded`;
  }

  return {
    metric,
    limits,
    usage,
    blocked,
    reason,
  };
}

/**
 * Check budget for an API key with minimal info (for enforcement).
 * Returns true if allowed, false if blocked.
 */
export function checkBudgetAllowed(
  apiKeyId: string,
  metric: BudgetMetric,
  limits: { daily: number | null; weekly: number | null; monthly: number | null }
): boolean {
  return !evaluateBudget(apiKeyId, metric, limits).blocked;
}

// ──────────────── Cleanup ────────────────

/**
 * Clean up old ledger entries.
 * By default keeps 90 days (matching the trigger).
 */
export function cleanupOldLedgerEntries(keepDays = 90): number {
  const db = getDbInstance();
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;

  try {
    const result = db.prepare("DELETE FROM api_key_budget_ledger WHERE timestamp < ?").run(cutoff);
    return result.changes || 0;
  } catch (error) {
    console.error("[BudgetLedger] Failed to cleanup old entries:", error);
    return 0;
  }
}
