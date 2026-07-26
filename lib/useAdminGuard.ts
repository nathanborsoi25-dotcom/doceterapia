"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useAdminGuard() {
  const router = useRouter();
  useEffect(() => {
    const ok = window.localStorage.getItem("dt_admin_ok");
    if (!ok) router.replace("/admin/login");
  }, [router]);
}
