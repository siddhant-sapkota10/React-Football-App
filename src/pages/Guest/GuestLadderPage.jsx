// src/pages/Guest/GuestLadderPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase";

/* ---------- config ---------- */
const GROUP_ID = "groupA-2025";

/* ---------- helpers ---------- */
const norm = (s) => (s ? String(s).trim().toLowerCase() : "");
const cap = (s) =>
  typeof s === "string" && s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const sanitizeUrl = (u) => {
  if (!u || typeof u !== "string") return "";
  const raw = u.trim();
  try {
    const url = new URL(raw, window.location.origin);
    if (/drive\.google\.com/i.test(url.hostname)) {
      const id = raw.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id");
      if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    }
  } catch {}
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("http://")) return raw.replace(/^http:\/\//, "https://");
  return raw;
};

const scoreFor = (f, isHome) =>
  typeof f.scoreA === "number" && typeof f.scoreB === "number"
    ? isHome
      ? f.scoreA
      : f.scoreB
    : null;

/* ---------- subcomponents ---------- */
function OutcomeDot({ v }) {
  const map = {
    W: { class: "bg-emerald-400/90 text-[#0a0f16]", glyph: "✔" },
    D: { class: "bg-slate-400/80 text-slate-900", glyph: "–" },
    L: { class: "bg-rose-500/90 text-white", glyph: "✖" },
    N: { class: "ring-2 ring-slate-500/50 text-slate-400", glyph: "○" },
  };
  const m = map[v] || map.N;
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${m.class}`}
      title={v}
    >
      {m.glyph}
    </span>
  );
}

function ClubCell({ name, logoURL }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      {logoURL ? (
        <img
          src={logoURL}
          alt={name}
          className="w-8 h-8 rounded-full bg-[#101822]/60 ring-1 ring-[#00d0ff]/30 object-contain shrink-0"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      ) : null}
      <span className="font-medium truncate text-slate-100">{name}</span>
    </div>
  );
}

function computeStandings(fixtures, clubsById, { uptoRound = null } = {}) {
  const row = () => ({ P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, PTS: 0, last: [] });
  const T = {};
  const get = (id) => (T[id] ??= row());

  const sorted = [...fixtures].sort((a, b) => {
    const ra = Number(a.roundNumber ?? 0);
    const rb = Number(b.roundNumber ?? 0);
    return ra - rb || String(a.date ?? "").localeCompare(String(b.date ?? ""));
  });

  for (const f of sorted) {
    if (uptoRound != null && Number(f.roundNumber) > Number(uptoRound)) continue;
    const [homeRaw, awayRaw] = f.clubIds ?? [];
    const HId = norm(homeRaw), AId = norm(awayRaw);
    if (!HId || !AId) continue;

    const sh = scoreFor(f, true), sa = scoreFor(f, false);
    if (!Number.isFinite(sh) || !Number.isFinite(sa)) {
      get(HId).last.push("N"); get(AId).last.push("N");
      continue;
    }

    const H = get(HId), A = get(AId);
    H.P++; A.P++; H.GF += sh; H.GA += sa; A.GF += sa; A.GA += sh;
    H.GD = H.GF - H.GA; A.GD = A.GF - A.GA;

    if (sh > sa) { H.W++; H.PTS += 3; A.L++; H.last.push("W"); A.last.push("L"); }
    else if (sh < sa) { A.W++; A.PTS += 3; H.L++; H.last.push("L"); A.last.push("W"); }
    else { H.D++; A.D++; H.PTS++; A.PTS++; H.last.push("D"); A.last.push("D"); }
  }

  const rows = Object.entries(T).map(([clubId, r]) => ({
    clubId,
    name: clubsById[clubId]?.name ?? cap(clubId),
    logoURL: clubsById[clubId]?.logoURL ?? "",
    ...r,
  }));
  rows.forEach((r) => (r.last = r.last.slice(-5)));
  rows.sort((a, b) =>
    b.PTS - a.PTS || b.GD - a.GD || b.GF - a.GF || a.name.localeCompare(b.name)
  );
  rows.forEach((r, i) => (r.POS = i + 1));
  return rows;
}

/* ---------- page ---------- */
export default function GuestLadderPage() {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState({});
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roundFilter, setRoundFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "clubs"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const map = Object.fromEntries(
        list.map((c) => [
          norm(c.id),
          {
            name: c.name ?? cap(c.id),
            logoURL: sanitizeUrl(c.LogoURL ?? c.logoURL ?? c.logo ?? ""),
          },
        ])
      );
      setClubs(map);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const q = query(collection(db, `groups/${GROUP_ID}/fixtures`), orderBy("roundNumber", "asc"));
        const snap = await getDocs(q);
        setFixtures(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const roundOptions = useMemo(() => {
    const s = new Set();
    fixtures.forEach((f) => f.roundNumber != null && s.add(Number(f.roundNumber)));
    return [...s].sort((a, b) => a - b);
  }, [fixtures]);

  const rows = useMemo(() => {
    const upto = roundFilter === "all" ? null : Number(roundFilter);
    return computeStandings(fixtures, clubs, { uptoRound: upto });
  }, [fixtures, clubs, roundFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f16] via-[#0d111a] to-[#0a0f16] text-slate-100 relative overflow-hidden">
      {/* background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-gradient-to-br from-[#00f6a3]/10 to-[#00d0ff]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-gradient-to-tr from-[#00d0ff]/10 to-[#00f6a3]/10 rounded-full blur-3xl"></div>
      </div>

      {/* navbar */}
      <header className="sticky top-0 z-40 bg-[#111827]/80 backdrop-blur-md border-b border-[#00f6a3]/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-center">
          <nav className="flex gap-1 bg-[#0f172a]/60 ring-1 ring-[#00d0ff]/20 rounded-xl p-1">
            <button
              onClick={() => navigate('/guest')}
              className="px-4 py-1.5 text-sm rounded-lg text-slate-300 hover:text-white hover:bg-[#00d0ff]/10 transition"
            >
              Fixtures / Results
            </button>
            <button
              className="px-4 py-1.5 text-sm rounded-lg bg-gradient-to-r from-[#00f6a3] to-[#00d0ff] text-[#0a0f16] font-semibold shadow-[0_0_10px_rgba(0,255,200,0.2)]"
              aria-current="page"
            >
              Ladder
            </button>
          </nav>
        </div>
      </header>

      {/* main */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* round filter */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-3 bg-[#0e1520]/70 px-4 py-2 rounded-xl ring-1 ring-[#00f6a3]/10 backdrop-blur">
            <label className="text-sm text-slate-400">Up to round</label>
            <select
              value={roundFilter}
              onChange={(e) => setRoundFilter(e.target.value)}
              className="bg-[#1a2433]/70 rounded-lg text-sm px-3 py-1.5 text-slate-100 focus:ring-2 focus:ring-[#00d0ff] outline-none"
            >
              <option value="all">All</option>
              {roundOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ladder card */}
        <div className="bg-[#111827]/60 backdrop-blur-lg rounded-3xl ring-1 ring-[#00d0ff]/10 shadow-[0_0_25px_rgba(0,255,200,0.05)] p-6 max-w-5xl mx-auto">
          <h2 className="text-xl font-extrabold mb-4 bg-gradient-to-r from-[#00f6a3] to-[#00d0ff] bg-clip-text text-transparent">
            SAPKOTIX Ladder
          </h2>

          {loading ? (
            <p className="text-slate-400">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-slate-400">No results yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-300 border-b border-[#00f6a3]/10">
                    <tr>
                      <th className="py-2 pr-3 text-left">Team</th>
                      <th className="py-2 px-2 text-right">MP</th>
                      <th className="py-2 px-2 text-right">W</th>
                      <th className="py-2 px-2 text-right">D</th>
                      <th className="py-2 px-2 text-right">L</th>
                      <th className="py-2 px-2 text-right">GF</th>
                      <th className="py-2 px-2 text-right">GA</th>
                      <th className="py-2 px-2 text-right">GD</th>
                      <th className="py-2 px-2 text-right font-semibold">Pts</th>
                      <th className="py-2 pl-3 text-right">Last 5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr
                        key={r.clubId}
                        className={`border-b border-[#00f6a3]/5 ${
                          idx < 2 ? "bg-gradient-to-r from-[#00f6a3]/5 to-[#00d0ff]/5" : ""
                        }`}
                      >
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-3">
                            <div className="w-6 text-right text-slate-500 font-semibold">{r.POS}</div>
                            <ClubCell name={cap(r.name)} logoURL={r.logoURL} />
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">{r.P}</td>
                        <td className="py-3 px-2 text-right">{r.W}</td>
                        <td className="py-3 px-2 text-right">{r.D}</td>
                        <td className="py-3 px-2 text-right">{r.L}</td>
                        <td className="py-3 px-2 text-right">{r.GF}</td>
                        <td className="py-3 px-2 text-right">{r.GA}</td>
                        <td className="py-3 px-2 text-right">{r.GD}</td>
                        <td className="py-3 px-2 text-right font-extrabold text-emerald-400">{r.PTS}</td>
                        <td className="py-3 pl-3 text-right">
                          <div className="inline-flex gap-1.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <OutcomeDot key={i} v={r.last[i] ?? "N"} />
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 bg-[#0e1520]/70 rounded-2xl ring-1 ring-[#00f6a3]/10 p-4">
                <div className="grid sm:grid-cols-2 gap-4 text-slate-300 text-sm">
                  <div>
                    <div className="font-semibold mb-2 text-emerald-300">Qualification</div>
                    <div className="flex items-center gap-3">
                      <span className="inline-block w-3 h-3 rounded-sm bg-gradient-to-r from-[#00f6a3]/70 to-[#00d0ff]/70 ring-1 ring-[#00d0ff]/40"></span>
                      <span>Top 2 highlighted</span>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold mb-2 text-cyan-300">Last 5 matches</div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1">
                        <OutcomeDot v="W" /><span>Win</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <OutcomeDot v="D" /><span>Draw</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <OutcomeDot v="L" /><span>Loss</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <OutcomeDot v="N" /><span>Not played</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
