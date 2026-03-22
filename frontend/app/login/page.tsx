"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/context/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/button";
import { Shield, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthContext();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { onboarded } = await login(email, password);
      router.push(onboarded ? "/map" : "/onboarding");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid credentials";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#08080d] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-10">
          <Shield className="size-6 text-[#6c9cff]" />
          <span className="text-lg font-semibold tracking-tight text-white/90">
            CityWatch
          </span>
        </Link>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8">
          <h1 className="text-xl font-semibold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-white/40 mb-6">Sign in to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 focus-visible:ring-[#4d7fff]/50"
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 focus-visible:ring-[#4d7fff]/50"
            />

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-xl text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#0d0d14] px-3 text-white/30">or</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-10 bg-white/[0.03] border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.06] rounded-xl text-sm cursor-pointer transition-colors"
            disabled
          >
            Continue with Google
          </Button>
        </div>

        <p className="text-center text-sm text-white/30 mt-6">
          No account?{" "}
          <Link href="/signup" className="text-[#7ba4ff] hover:text-[#99baff] transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
