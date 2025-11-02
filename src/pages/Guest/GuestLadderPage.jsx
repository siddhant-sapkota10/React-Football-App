// src/pages/GuestLadderPage.jsx
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

const scoreFor = (f, isHome) =>
  typeof f.scoreA === "number" && typeof f.scoreB === "number"
    ? isHome
      ? f.scoreA
      : f.scoreB
    : null;

function OutcomeDot({ v }) {
  const map = {
    W: { class: "bg-emerald-500/90 text-emerald-950", glyph: "✔" },
    D: { class: "bg-slate-400/90 text-slate-900", glyph: "–" },
    L: { class: "bg-rose-500/90 text-rose-50", glyph: "✖" },
    N: { class: "ring-2 ring-slate-400/50 text-slate-400", glyph: "○" },
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
    <div className="flex items-center gap-3">
      {logoURL ? (
        <img
          src={logoURL}
          alt={name}
          className="w-8 h-8 rounded-full bg-slate-700/40 ring-1 ring-slate-700 object-contain shrink-0"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      ) : null}
      <span className="font-medium">{name}</span>
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
    if (ra !== rb) return ra - rb;
    return String(a.date ?? "").localeCompare(String(b.date ?? ""));
    // (time not needed for standings)
  });

  for (const f of sorted) {
    if (uptoRound != null && Number(f.roundNumber) > Number(uptoRound)) continue;

    const [homeRaw, awayRaw] = f.clubIds ?? [];
    const HId = norm(homeRaw);
    const AId = norm(awayRaw);
    if (!HId || !AId) continue;

    const sh = scoreFor(f, true);
    const sa = scoreFor(f, false);

    if (!Number.isFinite(sh) || !Number.isFinite(sa)) {
      get(HId).last.push("N");
      get(AId).last.push("N");
      continue;
    }

    const H = get(HId), A = get(AId);
    H.P++; A.P++;
    H.GF += sh; H.GA += sa;
    A.GF += sa; A.GA += sh;
    H.GD = H.GF - H.GA;
    A.GD = A.GF - A.GA;

    if (sh > sa) {
      H.W++; H.PTS += 3; A.L++; H.last.push("W"); A.last.push("L");
    } else if (sh < sa) {
      A.W++; A.PTS += 3; H.L++; H.last.push("L"); A.last.push("W");
    } else {
      H.D++; A.D++; H.PTS++; A.PTS++; H.last.push("D"); A.last.push("D");
    }
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

  // clubs
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "clubs"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const map = Object.fromEntries(
        list.map((c) => [
          norm(c.id),
          {
            name: c.name ?? cap(c.id),
            logoURL: c.LogoURL ?? c.logoURL ?? c.logoUrl ?? "",
          },
        ])
      );
      setClubs(map);
    })();
  }, []);

  // fixtures (from group)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, `groups/${GROUP_ID}/fixtures`),
          orderBy("roundNumber", "asc")
        );
        const snap = await getDocs(q);
        setFixtures(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const roundOptions = useMemo(() => {
    const rounds = new Set();
    fixtures.forEach((f) => {
      if (f.roundNumber != null) rounds.add(Number(f.roundNumber));
    });
    return [...rounds].sort((a, b) => a - b);
  }, [fixtures]);

  const rows = useMemo(() => {
    const upto = roundFilter === "all" ? null : Number(roundFilter);
    return computeStandings(fixtures, clubs, { uptoRound: upto });
  }, [fixtures, clubs, roundFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 text-white">
      {/* TOP STICKY BAR */}
      <div className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="py-3 flex items-center justify-center">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-cyan-400 to-green-400">
              SAPKOTIX
            </h1>
          </div>
        </div>
      </div>

      {/* NAVBAR */}
      <header className="bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center">
            <nav className="flex items-center gap-1 rounded-xl bg-slate-800/60 p-1 ring-1 ring-slate-700">
              <button
                className="px-3 py-1.5 text-sm font-semibold rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/70"
                onClick={() => navigate("/guest")}
              >
                Fixtures / Results
              </button>
              <button
                className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-700 text-white"
                aria-current="page"
              >
                Ladders
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="max-w-4xl mx-auto mb-4">
          <div className="flex justify-center items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Up to round</label>
              <select
                value={roundFilter}
                onChange={(e) => setRoundFilter(e.target.value)}
                className="bg-slate-800 text-sm rounded-lg px-3 py-2 ring-1 ring-slate-700 focus:outline-none focus:ring-blue-500"
              >
                <option value="all">All rounds</option>
                {roundOptions.map((r) => (
                  <option key={r} value={String(r)}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Ladder card */}
        <div className="max-w-4xl mx-auto bg-slate-800/60 rounded-3xl p-6 shadow-lg ring-1 ring-slate-700">
          <h2 className="text-xl font-bold mb-4 text-blue-400">Ladder</h2>

          {loading ? (
            <p className="text-slate-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-slate-400">No results yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-300">
                    <tr className="border-b border-slate-700/70">
                      <th className="py-2 pr-3 text-left">Team</th>
                      <th className="py-2 px-3 text-right">MP</th>
                      <th className="py-2 px-3 text-right">W</th>
                      <th className="py-2 px-3 text-right">D</th>
                      <th className="py-2 px-3 text-right">L</th>
                      <th className="py-2 px-3 text-right">GF</th>
                      <th className="py-2 px-3 text-right">GA</th>
                      <th className="py-2 px-3 text-right">GD</th>
                      <th className="py-2 pl-3 text-right">Pts</th>
                      <th className="py-2 pl-4 text-right">Last 5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr
                        key={r.clubId}
                        className={`border-b border-slate-800/70 ${
                          idx < 2 ? "bg-sky-500/[0.04]" : ""
                        }`}
                      >
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-3">
                            <div className="w-6 text-right text-slate-400 font-semibold">
                              {r.POS}
                            </div>
                            <ClubCell name={cap(r.name)} logoURL={r.logoURL} />
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">{r.P}</td>
                        <td className="py-3 px-3 text-right">{r.W}</td>
                        <td className="py-3 px-3 text-right">{r.D}</td>
                        <td className="py-3 px-3 text-right">{r.L}</td>
                        <td className="py-3 px-3 text-right">{r.GF}</td>
                        <td className="py-3 px-3 text-right">{r.GA}</td>
                        <td className="py-3 px-3 text-right">{r.GD}</td>
                        <td className="py-3 pl-3 text-right font-extrabold">
                          {r.PTS}
                        </td>
                        <td className="py-3 pl-4 pr-3 text-right">
                          <div className="inline-flex gap-2">
                            {r.last.slice(-5).map((v, i) => (
                              <OutcomeDot key={i} v={v} />
                            ))}
                            {Array.from({
                              length: Math.max(0, 5 - r.last.length),
                            }).map((_, i) => (
                              <OutcomeDot key={`pad-${i}`} v="N" />
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 rounded-2xl bg-slate-900/50 ring-1 ring-slate-800 p-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-slate-300 font-semibold mb-2">
                      Qualification
                    </div>
                    <div className="flex items-center gap-3 text-slate-300">
                      <span className="inline-block w-3 h-3 rounded-sm bg-sky-500/70 ring-1 ring-sky-400/40"></span>
                      <span>Top 2 highlighted</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-300 font-semibold mb-2">
                      Last 5 matches
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <OutcomeDot v="W" />
                        <span>Win</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <OutcomeDot v="D" />
                        <span>Draw</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <OutcomeDot v="L" />
                        <span>Loss</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <OutcomeDot v="N" />
                        <span>Not played</span>
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
