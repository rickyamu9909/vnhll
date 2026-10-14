"use client";

import { useParams } from "next/navigation";
import { CustomerShell } from "@/components/CustomerShell";
import { TrackView } from "@/components/TrackView";

export default function CustomerTrackPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <CustomerShell selected="orders">
      <TrackView apiUrl={`/api/orders/${id}/track`} backHref="/orders" />
    </CustomerShell>
  );
}
