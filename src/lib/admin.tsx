import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const ADMIN_EMAIL = "walshyy2277@gmail.com";

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    const admin = user.email === ADMIN_EMAIL;
    setIsAdmin(admin);
    setChecked(true);
    if (!admin) navigate("/");
  }, [user, authLoading, navigate]);

  return { user, isAdmin, loading: authLoading || !checked };
}
