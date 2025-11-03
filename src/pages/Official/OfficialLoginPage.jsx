// src/pages/OfficialLogin.jsx
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import { useNavigate } from "react-router-dom";

export default function OfficialLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/official/home");
    } catch (err) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0a0f16] via-[#0d111a] to-[#0a0f16] text-[#f1f5f9] px-4 relative overflow-hidden">

      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-28 -left-20 w-72 h-72 bg-gradient-to-br from-emerald-400/25 to-cyan-400/25 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tr from-cyan-500/20 to-emerald-300/20 rounded-full blur-3xl"></div>
      </div>

      {/* Card */}
      <form
        onSubmit={handleLogin}
        className="z-10 w-full max-w-sm sm:max-w-md md:max-w-lg bg-[#111827]/70 backdrop-blur-lg p-8 sm:p-10 rounded-3xl shadow-[0_0_25px_rgba(0,255,200,0.08)] ring-1 ring-emerald-400/20 hover:ring-emerald-400/40 transition-all duration-300"
      >
        <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-8 bg-gradient-to-r from-[#00f6a3] to-[#00d0ff] bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(0,246,163,0.3)]">
          Official Login
        </h2>

        {/* Email Input */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Email
          </label>
          <input
            type="email"
            placeholder="official@sapkotix.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2.5 sm:p-3 rounded-lg bg-[#1a2433]/70 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00f6a3] focus:bg-[#1e293b]/80 transition"
            autoComplete="username"
            required
          />
        </div>

        {/* Password Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Password
          </label>
          <input
            type="password"
            placeholder="Enter your secure password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2.5 sm:p-3 rounded-lg bg-[#1a2433]/70 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00d0ff] focus:bg-[#1e293b]/80 transition"
            autoComplete="current-password"
            required
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full py-2.5 sm:py-3 font-bold rounded-full bg-gradient-to-r from-[#00f6a3] to-[#00d0ff] text-slate-900 hover:brightness-110 hover:shadow-[0_0_20px_rgba(0,255,200,0.4)] transition-all duration-300"
        >
          Login
        </button>

        {/* Error Message */}
        {error && (
          <p className="text-red-400 text-sm mt-4 text-center">{error}</p>
        )}

        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-6 w-full py-2.5 sm:py-3 rounded-full bg-[#1f2937]/80 text-slate-300 font-semibold hover:text-white hover:bg-[#273548]/90 ring-1 ring-slate-700/50 transition"
        >
          Back to Home
        </button>
      </form>
    </div>
  );
}
