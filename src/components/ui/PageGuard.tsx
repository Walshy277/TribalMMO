import { useAuth } from "@/lib/auth";
import { useGame } from "@/lib/game";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export function useRequireAuth() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  return { user, authLoading };
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { character, loading: gameLoading, initialLoadDone } = useGame();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || gameLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    if (initialLoadDone && !character) {
      navigate("/play");
    }
  }, [user, authLoading, gameLoading, character, initialLoadDone, navigate]);

  if (authLoading || gameLoading || !initialLoadDone) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#6e656c] text-xs uppercase tracking-widest" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!user || !character) return null;

  return <>{children}</>;
}
