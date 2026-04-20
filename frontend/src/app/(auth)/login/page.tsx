"use client";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <section className="flex items-center border-r border-amber-200 bg-amber-50 bg-[radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.22),transparent_40%),radial-gradient(circle_at_82%_8%,rgba(217,119,6,0.14),transparent_35%),repeating-linear-gradient(120deg,rgba(120,53,15,0.07)_0px,rgba(120,53,15,0.07)_1px,transparent_1px,transparent_6px),repeating-linear-gradient(30deg,rgba(146,64,14,0.05)_0px,rgba(146,64,14,0.05)_2px,transparent_2px,transparent_9px)] px-8 py-10 text-amber-950 md:px-14">
        <div className="max-w-xl space-y-6">
          <Image src="/gostaff-logo.png" alt="GoStaff logo" width={160} height={40} className="h-10 w-auto object-contain" priority />
          <div className="space-y-3">
            <p className="inline-flex rounded-full border border-amber-300 bg-amber-100/70 px-3 py-1 text-xs font-medium uppercase tracking-wide text-amber-900">
              About GoStaff
            </p>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">Your complete workforce operations platform.</h1>
            <p className="text-sm text-amber-900/80 md:text-base">
              GoStaff helps HR teams onboard employees faster, keep compliance on track, and run approvals and payroll workflows in one place.
            </p>
          </div>
          <ul className="space-y-2 text-sm text-amber-900/85">
            <li>- Structured onboarding with document and stage tracking</li>
            <li>- Compliance alerts for expiring records and reuploads</li>
            <li>- Payroll workflow from preparation to final approval</li>
          </ul>
        </div>
      </section>

      <section className="flex items-center justify-center bg-slate-100 px-6 py-10 md:px-10">
        <form
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const result = await signIn("credentials", { email, password, callbackUrl: "/dashboard", redirect: true });
            if (result?.error) setError("Invalid credentials");
          }}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Welcome back</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Sign in to GoStaff</h2>
          <p className="mt-1 text-sm text-slate-500">Use your role account to continue to dashboard.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

          <button className="mt-5 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white" type="submit">
            Sign in
          </button>
          <p className="mt-3 text-xs text-slate-500">Demo default: admin@demo.com / admin123</p>
        </form>
      </section>
    </div>
  );
}
