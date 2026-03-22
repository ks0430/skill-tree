"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold font-mono mb-8 text-center bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent">
          SkillForge
        </h1>

        <form onSubmit={handleLogin} className="glass rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-center">Sign In</h2>

          {error && (
            <div className="text-red-400 text-sm bg-red-400/10 rounded-lg p-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-navy-800 border border-glass-border text-white placeholder-slate-500 focus:outline-none focus:border-accent-blue"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-navy-800 border border-glass-border text-white placeholder-slate-500 focus:outline-none focus:border-accent-blue"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-accent-blue text-white font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Spinner />}
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="text-sm text-slate-500 text-center">
            No account?{" "}
            <Link href="/signup" className="text-accent-blue hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
