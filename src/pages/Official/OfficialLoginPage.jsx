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
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
      <form
        onSubmit={handleLogin}
        className="bg-slate-800/80 p-6 rounded-2xl w-full max-w-sm shadow-lg ring-1 ring-slate-700"
      >
        <h2 className="text-xl font-bold mb-4 text-blue-400">Official Login</h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 p-2 rounded bg-slate-700 focus:outline-none"
          autoComplete="username"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-3 p-2 rounded bg-slate-700 focus:outline-none"
          autoComplete="current-password"
          required
        />

        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 py-2 rounded font-semibold"
        >
          Login
        </button>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </form>
    </div>
  );
}
