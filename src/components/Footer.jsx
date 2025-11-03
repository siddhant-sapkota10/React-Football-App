// src/components/Footer.jsx
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full mt-auto py-6 text-center bg-[#0b0f17]/90 backdrop-blur-md border-t border-[#00f6a3]/10 shadow-[0_-2px_12px_rgba(0,255,200,0.05)]">
      <div className="max-w-4xl mx-auto px-4">
        <p className="text-sm text-slate-400">
          © {year} <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#00f6a3] via-[#00d0ff] to-[#00f6a3]">
            SAPKOTIX League Tracker
          </span>
        </p>
        <p className="mt-1 text-xs text-slate-500 tracking-wide">
          Built with <span className="text-emerald-400 font-medium">React JS</span> &{" "}
          <span className="text-cyan-400 font-medium">Firebase</span>
        </p>
      </div>
    </footer>
  );
}
