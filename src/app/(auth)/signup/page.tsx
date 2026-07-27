"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Flame, UserPlus } from "lucide-react";

export default function SignupPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Sign Up — TribalMMO";
  }, []);

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

  const handleGoogle = async () => {
    setError("");
    const result = await signInWithGoogle();
    if (result.error) setError(result.error);
  };

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-tribal-500 flex items-center justify-center mb-4">
          <Flame size={32} className="text-tribal-950" />
        </div>
        <h1 className="text-3xl font-bold text-tribal-100">Join the Tribe</h1>
        <p className="text-tribal-500 mt-2">Create your account to begin</p>
      </div>
      <div className="card">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={handleGoogle}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-tribal-800/30"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-[#1a181e] text-tribal-600">or sign up with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-tribal-400 mb-2 uppercase tracking-wider">Username</label>
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
            <label className="block text-xs font-bold text-tribal-400 mb-2 uppercase tracking-wider">Email</label>
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
            <label className="block text-xs font-bold text-tribal-400 mb-2 uppercase tracking-wider">Password</label>
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
            <div className="bg-[#2a1414] border border-[#6e2424] rounded-lg p-3 text-[#d05050] text-sm">
              {error}
            </div>
          )}
          <Button type="submit" variant="primary" size="lg" className="w-full" icon={<UserPlus size={18} />} loading={loading}>
            Create Account
          </Button>
        </form>
        <div className="mt-6 pt-4 border-t border-tribal-800/20 text-center">
          <p className="text-tribal-500 text-sm">
            Already have an account?{" "}
            <a href="/login" className="text-tribal-400 hover:text-tribal-300 font-semibold transition-colors">
              Login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
