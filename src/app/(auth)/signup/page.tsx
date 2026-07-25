"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Flame, UserPlus } from "lucide-react";

export default function SignupPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signUp(email, password, username);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/");
    }
  };

  return (
    <div className="w-full max-w-md animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-tribal-800 border border-tribal-700/50 flex items-center justify-center mb-4">
          <Flame size={32} className="text-tribal-400" />
        </div>
        <h1 className="text-3xl font-bold text-tribal-100">Join the Tribe</h1>
        <p className="text-tribal-400 mt-2">Create your account to begin</p>
      </div>
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-tribal-300 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="Your tribal name"
              required
              minLength={2}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-tribal-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="your@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-tribal-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
              minLength={6}
            />
            <p className="text-tribal-600 text-xs mt-1.5">Minimum 6 characters</p>
          </div>
          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
          )}
          <Button type="submit" variant="primary" size="lg" className="w-full" icon={<UserPlus size={18} />} loading={loading}>
            Create Account
          </Button>
        </form>
        <div className="mt-6 pt-4 border-t border-tribal-700/50 text-center">
          <p className="text-tribal-400 text-sm">
            Already have an account?{" "}
            <a href="/login" className="text-tribal-200 hover:text-tribal-100 font-semibold transition-colors">
              Login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
