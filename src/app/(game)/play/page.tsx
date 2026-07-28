import { useAuth } from "@/lib/auth";
import { useGame } from "@/lib/game";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { character, loading: gameLoading } = useGame();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !gameLoading && character) {
      navigate("/profile");
    }
  }, [character, authLoading, gameLoading, navigate]);

  if (authLoading || gameLoading) {
    return <LoadingSkeleton />;
  }

  return null;
}
