"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ADMIN_EMAIL = "walshyy2277@gmail.com";

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    const admin = user.email === ADMIN_EMAIL;
    setIsAdmin(admin);
    setChecked(true);
    if (!admin) router.push("/");
  }, [user, authLoading, router]);

  return { user, isAdmin, loading: authLoading || !checked };
}
