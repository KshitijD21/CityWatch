"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shield, Loader2, Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

export default function JoinGroupPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const code = params.code as string;

  const [status, setStatus] = useState<"loading" | "success" | "error" | "needs_auth">("loading");
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setStatus("needs_auth");
      return;
    }

    // Join the group
    apiFetch(`/api/groups/join/${code}`)
      .then((res) => {
        setGroupName(res.group_name);
        setStatus("success");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Invalid invite link");
        setStatus("error");
      });
  }, [code, user, authLoading]);

  return (
    <div className="min-h-dvh bg-[#08080d] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <Shield className="size-5 text-[#6c9cff]" />
          <span className="text-base font-semibold tracking-tight text-white/90">
            CityWatch
          </span>
        </div>

        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 text-center">
          {(status === "loading" || authLoading) && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="size-8 text-[#4d7fff] animate-spin" />
              <p className="text-sm text-white/50">Joining group...</p>
            </div>
          )}

          {status === "needs_auth" && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#4d7fff]/10 flex items-center justify-center">
                <Users className="size-6 text-[#7ba4ff]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">
                  You&apos;ve been invited
                </h2>
                <p className="text-sm text-white/40">
                  Sign in or create an account to join this group
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full mt-2">
                <Button
                  onClick={() => router.push(`/login?redirect=/join/${code}`)}
                  className="w-full h-10 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-xl text-sm font-medium cursor-pointer"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => router.push(`/signup?redirect=/join/${code}`)}
                  variant="outline"
                  className="w-full h-10 bg-white/[0.03] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.06] rounded-xl text-sm cursor-pointer"
                >
                  Create Account
                </Button>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="size-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">
                  Joined &ldquo;{groupName}&rdquo;
                </h2>
                <p className="text-sm text-white/40">
                  You&apos;re now a member of this group
                </p>
              </div>
              <Button
                onClick={() => router.push("/map")}
                className="w-full h-10 mt-2 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-xl text-sm font-medium cursor-pointer"
              >
                Go to Map
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <Users className="size-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">
                  Couldn&apos;t join group
                </h2>
                <p className="text-sm text-white/40">{error}</p>
              </div>
              <Link
                href="/map"
                className="text-sm text-[#7ba4ff] hover:text-[#4d7fff] transition-colors mt-2"
              >
                Go to Map
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
