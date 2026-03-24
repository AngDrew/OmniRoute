"use client";

/**
 * BudgetTab — API Key Budget Management
 *
 * Table view showing all API keys with their budget settings and usage.
 * Supports inline editing of daily, weekly, and monthly limits.
 * Budget metric can be USD or request count.
 */

import { useState, useEffect, useCallback } from "react";
import { Card, Button, Input, EmptyState, Badge } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";
import { useTranslations, useLocale } from "next-intl";

interface BudgetData {
  metric: "usd" | "requests";
  limits: {
    daily: number | null;
    weekly: number | null;
    monthly: number | null;
  };
  usage: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  blocked: boolean;
}

interface ApiKeyWithBudget {
  id: string;
  name: string;
  budget: BudgetData | null;
}

function formatCurrency(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatValue(value: number, metric: "usd" | "requests", locale: string): string {
  return metric === "usd" ? formatCurrency(value, locale) : formatNumber(value);
}

interface EditableRowProps {
  keyData: ApiKeyWithBudget;
  locale: string;
  onSave: (
    id: string,
    data: {
      budgetMetric: "usd" | "requests" | null;
      budgetDailyLimit: number | null;
      budgetWeeklyLimit: number | null;
      budgetMonthlyLimit: number | null;
    }
  ) => Promise<void>;
  isSaving: boolean;
}

function EditableRow({ keyData, locale, onSave, isSaving }: EditableRowProps) {
  const t = useTranslations("usage");
  const [metric, setMetric] = useState<"usd" | "requests" | null>(keyData.budget?.metric ?? null);
  const [dailyLimit, setDailyLimit] = useState<string>(
    keyData.budget?.limits.daily?.toString() ?? ""
  );
  const [weeklyLimit, setWeeklyLimit] = useState<string>(
    keyData.budget?.limits.weekly?.toString() ?? ""
  );
  const [monthlyLimit, setMonthlyLimit] = useState<string>(
    keyData.budget?.limits.monthly?.toString() ?? ""
  );

  const hasChanges =
    metric !== (keyData.budget?.metric ?? null) ||
    dailyLimit !== (keyData.budget?.limits.daily?.toString() ?? "") ||
    weeklyLimit !== (keyData.budget?.limits.weekly?.toString() ?? "") ||
    monthlyLimit !== (keyData.budget?.limits.monthly?.toString() ?? "");

  const handleSave = () => {
    onSave(keyData.id, {
      budgetMetric: metric,
      budgetDailyLimit: dailyLimit ? parseFloat(dailyLimit) : null,
      budgetWeeklyLimit: weeklyLimit ? parseFloat(weeklyLimit) : null,
      budgetMonthlyLimit: monthlyLimit ? parseFloat(monthlyLimit) : null,
    });
  };

  const isBlocked = keyData.budget?.blocked ?? false;

  return (
    <tr
      className={`border-b border-black/[0.03] dark:border-white/[0.03] ${isBlocked ? "bg-red-500/5" : ""}`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{keyData.name}</span>
          {isBlocked && (
            <Badge variant="error" size="sm">
              {t("blocked")}
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <select
          value={metric ?? ""}
          onChange={(e) => setMetric(e.target.value as "usd" | "requests" | null)}
          className="px-2 py-1 text-sm rounded border border-border/50 bg-surface/30"
          disabled={isSaving}
        >
          <option value="">{t("noBudget")}</option>
          <option value="usd">USD</option>
          <option value="requests">{t("requests")}</option>
        </select>
      </td>
      <td className="px-4 py-3">
        {metric ? (
          <div className="text-sm">
            <div className="mb-1">
              <span className="text-text-muted">{t("today")}: </span>
              <span className="font-medium">
                {formatValue(keyData.budget?.usage.daily ?? 0, metric, locale)}
              </span>
            </div>
            <div className="mb-1">
              <span className="text-text-muted">{t("thisWeek")}: </span>
              <span className="font-medium">
                {formatValue(keyData.budget?.usage.weekly ?? 0, metric, locale)}
              </span>
            </div>
            <div>
              <span className="text-text-muted">{t("thisMonth")}: </span>
              <span className="font-medium">
                {formatValue(keyData.budget?.usage.monthly ?? 0, metric, locale)}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-sm text-text-muted">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          step={metric === "usd" ? "0.01" : "1"}
          min="0"
          placeholder={t("unlimited")}
          value={dailyLimit}
          onChange={(e) => setDailyLimit(e.target.value)}
          disabled={!metric || isSaving}
          className="w-24 text-sm"
        />
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          step={metric === "usd" ? "0.01" : "1"}
          min="0"
          placeholder={t("unlimited")}
          value={weeklyLimit}
          onChange={(e) => setWeeklyLimit(e.target.value)}
          disabled={!metric || isSaving}
          className="w-24 text-sm"
        />
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          step={metric === "usd" ? "0.01" : "1"}
          min="0"
          placeholder={t("unlimited")}
          value={monthlyLimit}
          onChange={(e) => setMonthlyLimit(e.target.value)}
          disabled={!metric || isSaving}
          className="w-24 text-sm"
        />
      </td>
      <td className="px-4 py-3">
        {hasChanges && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            loading={isSaving}
            disabled={isSaving}
          >
            {t("save")}
          </Button>
        )}
      </td>
    </tr>
  );
}

export default function BudgetTab() {
  const t = useTranslations("usage");
  const locale = useLocale();
  const [keys, setKeys] = useState<ApiKeyWithBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const notify = useNotificationStore();

  const fetchBudgetData = useCallback(async () => {
    try {
      const res = await fetch("/api/usage/budget");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (error) {
      notify.error(t("budgetLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [notify, t]);

  useEffect(() => {
    fetchBudgetData();
  }, [fetchBudgetData]);

  const handleSave = async (
    id: string,
    data: {
      budgetMetric: "usd" | "requests" | null;
      budgetDailyLimit: number | null;
      budgetWeeklyLimit: number | null;
      budgetMonthlyLimit: number | null;
    }
  ) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      notify.success(t("budgetSaved"));
      await fetchBudgetData();
    } catch (error) {
      notify.error(t("budgetSaveFailed"));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex items-center gap-2 text-text-muted animate-pulse">
          <span className="material-symbols-outlined">account_balance_wallet</span>
          {t("loadingBudgetData")}
        </div>
      </Card>
    );
  }

  if (keys.length === 0) {
    return (
      <EmptyState
        icon="vpn_key"
        title={t("noApiKeysTitle")}
        description={t("noApiKeysDescription")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold">{t("budgetManagement")}</h3>
            <p className="text-sm text-text-muted">{t("budgetDescription")}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                <th className="px-4 py-3">{t("apiKey")}</th>
                <th className="px-4 py-3">{t("metric")}</th>
                <th className="px-4 py-3">{t("currentUsage")}</th>
                <th className="px-4 py-3">{t("dailyLimit")}</th>
                <th className="px-4 py-3">{t("weeklyLimit")}</th>
                <th className="px-4 py-3">{t("monthlyLimit")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <EditableRow
                  key={key.id}
                  keyData={key}
                  locale={locale}
                  onSave={handleSave}
                  isSaving={savingId === key.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
