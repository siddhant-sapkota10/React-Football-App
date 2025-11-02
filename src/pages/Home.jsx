import {useNavigate} from "react-router-dom"
export default function App() {
    const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-black to-slate-900 text-white font-sans">
      
      {/* Main container */}
      <div className="w-full max-w-6xl px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Left: Login as Player */}
        <div className="flex flex-col items-center justify-center text-center bg-slate-800/50 rounded-3xl p-8 shadow-lg ring-1 ring-red-600/40 hover:ring-red-500/70 transition">
          <h2 className="text-3xl font-extrabold text-red-400 mb-4">LOGIN AS</h2>
          <span className="text-red-500 text-4xl font-extrabold underline underline-offset-4">
            GUEST
          </span>
          <button onClick={() => navigate("/guest")} className="mt-8 px-6 py-2 rounded-full bg-red-600 hover:bg-red-500 font-semibold">
            Continue
          </button>
        </div>


        {/* Right: Login as Referee */}
        <div className="flex flex-col items-center justify-center text-center bg-slate-800/50 rounded-3xl p-8 shadow-lg ring-1 ring-green-600/40 hover:ring-green-500/70 transition">
          <h2 className="text-3xl font-extrabold text-green-400 mb-4">LOGIN AS</h2>
          <span className="text-green-500 text-4xl font-extrabold underline underline-offset-4">
            OFFICIAL
          </span>
          <button onClick={() => navigate("/official/login")} className="mt-8 px-6 py-2 rounded-full bg-green-600 hover:bg-green-500 font-semibold">
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
