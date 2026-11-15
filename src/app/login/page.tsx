import { HeartPulse, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { LoginForm } from "@/components/forms/LoginForm";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f3f5f4] px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-[-7rem] size-[25rem] rounded-full bg-[#dcece6]/75 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-[-8rem] size-[27rem] rounded-full bg-[#ebe9dc]/70 blur-3xl" />
      <div className="relative grid w-full max-w-[920px] overflow-hidden rounded-2xl border border-white/80 bg-white/75 shadow-[0_30px_90px_-40px_rgba(16,43,51,.35)] backdrop-blur-xl md:grid-cols-[1fr_0.85fr]">
        <section className="hidden flex-col justify-between bg-[#101f2a] p-10 text-white md:flex">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/10 text-[#a7e1d5]"><HeartPulse size={21} /></span>
            <span className="text-base font-semibold tracking-tight">caresync<span className="text-[#8fc8bb]">.</span></span>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8fc8bb]">Care coordination workspace</p>
            <h1 className="mt-4 max-w-sm text-3xl font-semibold leading-tight tracking-[-0.035em]">Clarity for the people who care.</h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">A shared view of care schedules and updates, scoped to your authorized membership.</p>
          </div>
          <p className="inline-flex items-center gap-2 text-[11px] text-slate-400"><ShieldCheck size={14} className="text-[#8fc8a8]" /> Access is enforced by your care-team permissions.</p>
        </section>
        <section className="p-6 sm:p-9 md:p-10">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-[#183e48] text-[#a7e1d5]"><HeartPulse size={21} /></span>
            <span className="text-base font-semibold tracking-tight text-[#18343c]">caresync<span className="text-[#4d8c7c]">.</span></span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#769087]">Secure sign in</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#18343c]">Welcome back</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#72858a]">Sign in to your account to view the care profiles you are authorized to access.</p>
          <div className="mt-7"><LoginForm /></div>
          <Link href="/invite" className="mt-4 inline-flex text-xs font-semibold text-[#47796e] hover:underline">Have an invitation code? Redeem it</Link>
          <p className="mt-4 text-xs text-[#89999c]">New to CareSync? <Link href="/register" className="font-semibold text-[#47796e] hover:underline">Create an account</Link></p>
          <p className="mt-5 border-t border-[#e9eeec] pt-4 text-[10px] leading-relaxed text-[#89999c]">
            An account does not grant patient access. Redeem an invitation from the care-profile owner. Never share your password or invitation code.
          </p>
        </section>
      </div>
    </main>
  );
}
