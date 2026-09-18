"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Code-split entry points for the Recharts charts. Recharts is the heaviest
 * client dependency in the app; loading it after hydration (and never on the
 * server, where ResponsiveContainer cannot measure anything anyway) keeps the
 * dashboard's first paint and JS budget small. Pages import from here.
 */
const ChartSkeleton = () => <Skeleton className="h-64 w-full rounded-xl" aria-busy="true" />;
const SmallChartSkeleton = () => <Skeleton className="h-56 w-full rounded-xl" aria-busy="true" />;

export const ReferralsOverTimeChart = dynamic(() => import("./charts").then((m) => m.ReferralsOverTimeChart), { ssr: false, loading: ChartSkeleton });
export const RevenueByCampaignChart = dynamic(() => import("./charts").then((m) => m.RevenueByCampaignChart), { ssr: false, loading: ChartSkeleton });
export const CostByCampaignChart = dynamic(() => import("./charts").then((m) => m.CostByCampaignChart), { ssr: false, loading: ChartSkeleton });
export const PartnerSplitChart = dynamic(() => import("./charts").then((m) => m.PartnerSplitChart), { ssr: false, loading: SmallChartSkeleton });
export const FunnelChart = dynamic(() => import("./charts").then((m) => m.FunnelChart), { ssr: false, loading: SmallChartSkeleton });
