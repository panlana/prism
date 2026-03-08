import type { Prisma, UserType } from "@prisma/client";

import { prisma } from "../lib/db.js";

export interface AiUsageFilters {
  days: number;
  agencyId?: string | undefined;
  provider?: string | undefined;
  gateway?: string | undefined;
  surface?: string | undefined;
  status?: string | undefined;
  model?: string | undefined;
  userType?: UserType | undefined;
}

export interface AiUsageSummary {
  requestCount: number;
  successCount: number;
  errorCount: number;
  errorRate: number;
  activeAgencyCount: number;
  activeUserCount: number;
  totalTokens: number;
  inputTokens: number;
  inputCachedTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  providerCost: number;
  cacheDiscount: number;
}

export interface AiUsageSeriesPoint {
  date: string;
  requestCount: number;
  errorCount: number;
  totalTokens: number;
  inputCachedTokens: number;
  providerCost: number;
}

export interface AiUsageBreakdownItem {
  key: string;
  label: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  totalTokens: number;
  inputTokens: number;
  inputCachedTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  providerCost: number;
  cacheDiscount: number;
}

export interface AiUsageRecentEvent {
  id: string;
  createdAt: Date;
  agencyName: string | null;
  userEmail: string | null;
  userDisplayName: string | null;
  userType: string | null;
  gateway: string;
  provider: string | null;
  model: string;
  surface: string;
  status: string;
  route: string | null;
  screen: string | null;
  latencyMs: number | null;
  inputTokens: number;
  inputCachedTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  providerCost: number;
}

export interface AiUsageFilterOptions {
  agencies: Array<{ id: string; name: string }>;
  providers: string[];
  gateways: string[];
  surfaces: string[];
  statuses: string[];
  models: string[];
  userTypes: UserType[];
}

export interface AiUsageReport {
  range: {
    start: string;
    end: string;
    days: number;
  };
  appliedFilters: {
    days: number;
    agencyId: string | null;
    provider: string | null;
    gateway: string | null;
    surface: string | null;
    status: string | null;
    model: string | null;
    userType: UserType | null;
  };
  summary: AiUsageSummary;
  timeSeries: AiUsageSeriesPoint[];
  breakdowns: {
    surfaces: AiUsageBreakdownItem[];
    providers: AiUsageBreakdownItem[];
    models: AiUsageBreakdownItem[];
    agencies: AiUsageBreakdownItem[];
  };
  recentEvents: AiUsageRecentEvent[];
  filterOptions: AiUsageFilterOptions;
}

interface AnalyticsEvent {
  createdAt: Date;
  agencyId: string | null;
  userId: string | null;
  provider: string | null;
  gateway: string;
  surface: string;
  status: string;
  model: string;
  userType: UserType | null;
  totalTokens: number;
  inputTokens: number;
  inputCachedTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  providerCost: Prisma.Decimal | null;
  cacheDiscount: Prisma.Decimal | null;
}

function toNumber(
  value: Prisma.Decimal | number | string | null | undefined
): number {
  if (value == null) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === "object" && "toNumber" in value) {
    return value.toNumber();
  }

  return 0;
}

function buildRange(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  return { start, end };
}

function buildWhere(filters: AiUsageFilters): {
  where: Prisma.AiUsageEventWhereInput;
  start: Date;
  end: Date;
} {
  const { start, end } = buildRange(filters.days);

  const where: Prisma.AiUsageEventWhereInput = {
    createdAt: {
      gte: start,
      lte: end,
    },
    ...(filters.agencyId ? { agencyId: filters.agencyId } : {}),
    ...(filters.provider ? { provider: filters.provider } : {}),
    ...(filters.gateway ? { gateway: filters.gateway } : {}),
    ...(filters.surface ? { surface: filters.surface } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.model ? { model: filters.model } : {}),
    ...(filters.userType ? { userType: filters.userType } : {}),
  };

  return { where, start, end };
}

function createEmptySummary(): AiUsageSummary {
  return {
    requestCount: 0,
    successCount: 0,
    errorCount: 0,
    errorRate: 0,
    activeAgencyCount: 0,
    activeUserCount: 0,
    totalTokens: 0,
    inputTokens: 0,
    inputCachedTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    providerCost: 0,
    cacheDiscount: 0,
  };
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function createDateSeries(start: Date, end: Date): Map<string, AiUsageSeriesPoint> {
  const points = new Map<string, AiUsageSeriesPoint>();
  const cursor = new Date(start);

  while (cursor <= end) {
    const key = dayKey(cursor);
    points.set(key, {
      date: key,
      requestCount: 0,
      errorCount: 0,
      totalTokens: 0,
      inputCachedTokens: 0,
      providerCost: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return points;
}

function updateBreakdown(
  map: Map<string, AiUsageBreakdownItem>,
  key: string,
  label: string,
  event: AnalyticsEvent
) {
  const existing = map.get(key) ?? {
    key,
    label,
    requestCount: 0,
    successCount: 0,
    errorCount: 0,
    totalTokens: 0,
    inputTokens: 0,
    inputCachedTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    providerCost: 0,
    cacheDiscount: 0,
  };

  existing.requestCount += 1;
  existing.successCount += event.status === "SUCCESS" ? 1 : 0;
  existing.errorCount += event.status === "ERROR" ? 1 : 0;
  existing.totalTokens += event.totalTokens;
  existing.inputTokens += event.inputTokens;
  existing.inputCachedTokens += event.inputCachedTokens;
  existing.outputTokens += event.outputTokens;
  existing.reasoningTokens += event.reasoningTokens;
  existing.providerCost += toNumber(event.providerCost);
  existing.cacheDiscount += toNumber(event.cacheDiscount);

  map.set(key, existing);
}

function sortBreakdown(items: AiUsageBreakdownItem[], limit?: number): AiUsageBreakdownItem[] {
  const sorted = items.sort((a, b) => {
    if (b.totalTokens !== a.totalTokens) {
      return b.totalTokens - a.totalTokens;
    }

    return b.requestCount - a.requestCount;
  });

  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}

function buildAnalytics(
  events: AnalyticsEvent[],
  start: Date,
  end: Date,
  agencyNames: Map<string, string>,
  breakdownLimit = 8
) {
  const summary = createEmptySummary();
  const activeAgencyIds = new Set<string>();
  const activeUserIds = new Set<string>();
  const seriesMap = createDateSeries(start, end);
  const surfaces = new Map<string, AiUsageBreakdownItem>();
  const providers = new Map<string, AiUsageBreakdownItem>();
  const models = new Map<string, AiUsageBreakdownItem>();
  const agencies = new Map<string, AiUsageBreakdownItem>();

  for (const event of events) {
    summary.requestCount += 1;
    summary.successCount += event.status === "SUCCESS" ? 1 : 0;
    summary.errorCount += event.status === "ERROR" ? 1 : 0;
    summary.totalTokens += event.totalTokens;
    summary.inputTokens += event.inputTokens;
    summary.inputCachedTokens += event.inputCachedTokens;
    summary.outputTokens += event.outputTokens;
    summary.reasoningTokens += event.reasoningTokens;
    summary.providerCost += toNumber(event.providerCost);
    summary.cacheDiscount += toNumber(event.cacheDiscount);

    if (event.agencyId) {
      activeAgencyIds.add(event.agencyId);
    }
    if (event.userId) {
      activeUserIds.add(event.userId);
    }

    const point = seriesMap.get(dayKey(event.createdAt));
    if (point) {
      point.requestCount += 1;
      point.errorCount += event.status === "ERROR" ? 1 : 0;
      point.totalTokens += event.totalTokens;
      point.inputCachedTokens += event.inputCachedTokens;
      point.providerCost += toNumber(event.providerCost);
    }

    updateBreakdown(surfaces, event.surface, event.surface, event);

    const providerKey = event.provider ?? event.gateway;
    const providerLabel = event.provider ?? `${event.gateway} (direct)`;
    updateBreakdown(providers, providerKey, providerLabel, event);

    updateBreakdown(models, event.model, event.model, event);

    const agencyKey = event.agencyId ?? "unknown";
    const agencyLabel = event.agencyId
      ? agencyNames.get(event.agencyId) ?? "Unknown agency"
      : "No agency";
    updateBreakdown(agencies, agencyKey, agencyLabel, event);
  }

  summary.activeAgencyCount = activeAgencyIds.size;
  summary.activeUserCount = activeUserIds.size;
  summary.errorRate =
    summary.requestCount > 0
      ? Number((summary.errorCount / summary.requestCount).toFixed(4))
      : 0;

  return {
    summary,
    timeSeries: Array.from(seriesMap.values()),
    breakdowns: {
      surfaces: sortBreakdown(Array.from(surfaces.values())),
      providers: sortBreakdown(Array.from(providers.values())),
      models: sortBreakdown(Array.from(models.values()), breakdownLimit),
      agencies: sortBreakdown(
        Array.from(agencies.values()).filter((item) => item.key !== "unknown"),
        breakdownLimit
      ),
    },
  };
}

async function getAgencyOptions() {
  return prisma.agency.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getAiUsageSummary(filters: AiUsageFilters) {
  const { where, start, end } = buildWhere(filters);

  const [events, agencies] = await Promise.all([
    prisma.aiUsageEvent.findMany({
      where,
      select: {
        createdAt: true,
        agencyId: true,
        userId: true,
        provider: true,
        gateway: true,
        surface: true,
        status: true,
        model: true,
        userType: true,
        totalTokens: true,
        inputTokens: true,
        inputCachedTokens: true,
        outputTokens: true,
        reasoningTokens: true,
        providerCost: true,
        cacheDiscount: true,
      },
    }),
    getAgencyOptions(),
  ]);

  const agencyNames = new Map(agencies.map((agency) => [agency.id, agency.name]));
  const analytics = buildAnalytics(events, start, end, agencyNames, 5);

  return {
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
      days: filters.days,
    },
    summary: analytics.summary,
    breakdowns: analytics.breakdowns,
  };
}

export async function getAiUsageReport(filters: AiUsageFilters): Promise<AiUsageReport> {
  const { where, start, end } = buildWhere(filters);

  const [
    events,
    recentEvents,
    agencies,
    providers,
    gateways,
    surfaces,
    statuses,
    models,
  ] = await Promise.all([
    prisma.aiUsageEvent.findMany({
      where,
      select: {
        createdAt: true,
        agencyId: true,
        userId: true,
        provider: true,
        gateway: true,
        surface: true,
        status: true,
        model: true,
        userType: true,
        totalTokens: true,
        inputTokens: true,
        inputCachedTokens: true,
        outputTokens: true,
        reasoningTokens: true,
        providerCost: true,
        cacheDiscount: true,
      },
    }),
    prisma.aiUsageEvent.findMany({
      where,
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        agency: {
          select: { name: true },
        },
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    getAgencyOptions(),
    prisma.aiUsageEvent.findMany({
      where: { provider: { not: null } },
      distinct: ["provider"],
      select: { provider: true },
      orderBy: { provider: "asc" },
    }),
    prisma.aiUsageEvent.findMany({
      distinct: ["gateway"],
      select: { gateway: true },
      orderBy: { gateway: "asc" },
    }),
    prisma.aiUsageEvent.findMany({
      distinct: ["surface"],
      select: { surface: true },
      orderBy: { surface: "asc" },
    }),
    prisma.aiUsageEvent.findMany({
      distinct: ["status"],
      select: { status: true },
      orderBy: { status: "asc" },
    }),
    prisma.aiUsageEvent.findMany({
      distinct: ["model"],
      select: { model: true },
      orderBy: { model: "asc" },
    }),
  ]);

  const agencyNames = new Map(agencies.map((agency) => [agency.id, agency.name]));
  const analytics = buildAnalytics(events, start, end, agencyNames);

  return {
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
      days: filters.days,
    },
    appliedFilters: {
      days: filters.days,
      agencyId: filters.agencyId ?? null,
      provider: filters.provider ?? null,
      gateway: filters.gateway ?? null,
      surface: filters.surface ?? null,
      status: filters.status ?? null,
      model: filters.model ?? null,
      userType: filters.userType ?? null,
    },
    summary: analytics.summary,
    timeSeries: analytics.timeSeries,
    breakdowns: analytics.breakdowns,
    recentEvents: recentEvents.map((event) => {
      const userDisplayName = [event.user?.firstName, event.user?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      return {
        id: event.id,
        createdAt: event.createdAt,
        agencyName: event.agency?.name ?? null,
        userEmail: event.user?.email ?? null,
        userDisplayName: userDisplayName || null,
        userType: event.userType ?? null,
        gateway: event.gateway,
        provider: event.provider,
        model: event.model,
        surface: event.surface,
        status: event.status,
        route: event.route,
        screen: event.screen,
        latencyMs: event.latencyMs,
        inputTokens: event.inputTokens,
        inputCachedTokens: event.inputCachedTokens,
        outputTokens: event.outputTokens,
        reasoningTokens: event.reasoningTokens,
        totalTokens: event.totalTokens,
        providerCost: toNumber(event.providerCost),
      };
    }),
    filterOptions: {
      agencies,
      providers: providers.flatMap((item) => (item.provider ? [item.provider] : [])),
      gateways: gateways.map((item) => item.gateway),
      surfaces: surfaces.map((item) => item.surface),
      statuses: statuses.map((item) => item.status),
      models: models.map((item) => item.model),
      userTypes: ["STAFF", "AGENCY", "INSURED"],
    },
  };
}
