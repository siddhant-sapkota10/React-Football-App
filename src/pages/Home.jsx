// src/pages/Home.jsx
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0a0f16] via-[#0d111a] to-[#0a0f16] text-[#f1f5f9] font-sans relative overflow-hidden">

      {/* Background glow layers */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-tr from-cyan-500/20 to-emerald-300/20 rounded-full blur-3xl"></div>
      </div>

      {/* Main container */}
      <main className="z-10 w-full max-w-6xl px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">

        {/* Guest Section */}
        <div className="flex flex-col items-center justify-center text-center bg-[#111827]/60 rounded-3xl p-8 shadow-xl ring-1 ring-emerald-400/30 hover:ring-emerald-400/60 hover:scale-[1.02] transition-all duration-300 backdrop-blur-md">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#00f6a3] mb-4 drop-shadow-[0_0_6px_rgba(0,246,163,0.4)]">
            CONTINUE AS
          </h2>
          <span className="text-4xl font-extrabold bg-gradient-to-r from-[#00f6a3] to-[#00d0ff] bg-clip-text text-transparent underline underline-offset-4">
            GUEST
          </span>
          <button
            onClick={() => navigate("/guest")}
            className="mt-8 px-6 py-2 rounded-full bg-gradient-to-r from-[#00f6a3] to-[#00d0ff] text-slate-900 font-bold hover:brightness-110 hover:shadow-[0_0_12px_rgba(0,255,200,0.4)] transition"
          >
            Continue
          </button>
        </div>

        {/* Official Section */}
        <div className="flex flex-col items-center justify-center text-center bg-[#111827]/60 rounded-3xl p-8 shadow-xl ring-1 ring-cyan-400/30 hover:ring-cyan-400/60 hover:scale-[1.02] transition-all duration-300 backdrop-blur-md">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#00d0ff] mb-4 drop-shadow-[0_0_6px_rgba(0,208,255,0.4)]">
            LOGIN AS
          </h2>
          <span className="text-4xl font-extrabold bg-gradient-to-r from-[#00d0ff] to-[#00f6a3] bg-clip-text text-transparent underline underline-offset-4">
            OFFICIAL
          </span>
          <button
            onClick={() => navigate("/official/login")}
            className="mt-8 px-6 py-2 rounded-full bg-gradient-to-r from-[#00d0ff] to-[#00f6a3] text-slate-900 font-bold hover:brightness-110 hover:shadow-[0_0_12px_rgba(0,208,255,0.4)] transition"
          >
            Login
          </button>
        </div>
      </main>
    </div>
  );
}
