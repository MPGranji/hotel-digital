import { redirect } from "next/navigation";
import { BusinessDashboard } from "@/features/dashboard/business-dashboard";
import { LiveRoomOverview } from "@/features/dashboard/live-room-overview";

export default async function DashboardPage({ searchParams }: Readonly<{ searchParams: Promise<{ view?: string }> }>) {
  const params = await searchParams;
  if (params.view === "operations") redirect("/operations");
  return <div className="space-y-8">
    <BusinessDashboard />
    <LiveRoomOverview />
  </div>;
}
