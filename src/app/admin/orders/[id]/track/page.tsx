"use client";

import { useParams } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { TrackView } from "@/components/TrackView";

export default function AdminTrackPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AdminShell>
      <TrackView apiUrl={`/api/admin/orders/${id}/track`} backHref="/admin/orders" />
    </AdminShell>
  );
}
