import { Heart, ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto w-full border-t border-black/[0.06] bg-white/40 backdrop-blur-md py-8 px-6 sm:px-12">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#4A5B72]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-lg bg-[#0D7C7A]/15 text-[#0D7C7A] flex items-center justify-center">
            <Heart className="w-3.5 h-3.5 fill-current" />
          </div>
          <span className="font-semibold text-[#0B192C]">CareSync AI Platform</span>
          <span>Care coordination workspace</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5 text-[#4A5B72]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2D6A4F]" />
            <span>Access follows your assigned care permissions</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
