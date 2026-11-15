import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { RegisterForm } from "@/components/forms/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f3f5f4] px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-[-8rem] size-[27rem] rounded-full bg-[#dcece6]/75 blur-3xl" />
      <section className="relative w-full max-w-[480px] rounded-2xl border border-white/80 bg-white/85 p-6 shadow-[0_30px_90px_-40px_rgba(16,43,51,.35)] backdrop-blur-xl sm:p-9">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#183e48] text-[#a7e1d5]"><HeartPulse size={21} /></span>
          <span className="text-base font-semibold tracking-tight text-[#18343c]">caresync<span className="text-[#4d8c7c]">.</span></span>
        </div>
        <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#769087]">Create your account</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#18343c]">Join your care team</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#72858a]">Create an account first, then redeem the single-use invitation provided by the care-profile owner.</p>
        <div className="mt-6"><RegisterForm /></div>
        <p className="mt-5 border-t border-[#e9eeec] pt-4 text-xs text-[#89999c]">Already have an account? <Link href="/login" className="font-semibold text-[#47796e] hover:underline">Sign in</Link></p>
      </section>
    </main>
  );
}
