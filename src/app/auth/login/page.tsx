"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-tribal-950 via-tribal-900/50 to-tribal-950">
      <div className="card w-full max-w-md border-tribal-600/20 animate-fade-in">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🏕️</div>
          <h1 className="text-2xl font-bold text-tribal-100">Welcome Back</h1>
          <p className="text-tribal-400 text-sm mt-1">Enter the world of Nervella</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-tribal-300 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              placeholder="your@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-tribal-300 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full"
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
          )}
          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <div className="mt-6 pt-4 border-t border-tribal-800 text-center">
          <p className="text-tribal-400 text-sm">
            New to TribalMMO?{" "}
            <a href="/auth/signup" className="text-tribal-300 hover:text-tribal-100 font-medium transition-colors">
              Create an account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
