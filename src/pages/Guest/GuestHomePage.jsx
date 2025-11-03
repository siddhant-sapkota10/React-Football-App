// src/pages/Guest/GuestHomePage.jsx
import { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

/* ---------- config ---------- */
const GROUP_ID = "groupA-2025";

/* ---------- helpers ---------- */
const norm = (s) => (s ? String(s).trim().toLowerCase() : "");
const cap = (s) =>
  typeof s === "string" && s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const firstDefined = (...xs) =>
  xs.find((x) => x !== undefined && x !== null && x !== "");

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

const asDate = (d, t) =>
  new Date(`${String(d || "9999-12-31")}T${String(t || "00:00")}:00`);
const sortByDateTime = (arr = []) =>
  (Array.isArray(arr) ? [...arr] : []).sort(
    (a, b) => asDate(a?.date, a?.time) - asDate(b?.date, b?.time)
  );

const Pin = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...props}>
    <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
  </svg>
);

function Team({ name, logoURL, align = "left" }) {
  const fallback = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={`inline-flex items-center gap-3 ${
        align === "right" ? "justify-end text-right" : ""
      }`}
    >
      {align !== "right" && (
        <img
          src={logoURL}
          alt={name}
          className="w-9 h-9 rounded-full object-contain bg-[#101822]/60 ring-1 ring-[#00d0ff]/20"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      {!logoURL && (
        <div className="w-9 h-9 rounded-full bg-[#14202f]/60 ring-1 ring-[#00f6a3]/20 flex items-center justify-center text-xs font-semibold text-emerald-300">
          {fallback}
        </div>
      )}
      <span className="truncate font-semibold text-slate-100 max-w-[160px] sm:max-w-[220px] md:max-w-[300px]">
        {name}
      </span>
      {align === "right" && (
        <img
          src={logoURL}
          alt={name}
          className="w-9 h-9 rounded-full object-contain bg-[#101822]/60 ring-1 ring-[#00d0ff]/20"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
    </div>
  );
}

function FixtureRow({ f, clubMap }) {
  const [homeRaw, awayRaw] = f.clubIds ?? [];
  const homeClub = clubMap[norm(homeRaw)] || { name: homeRaw, logoURL: "" };
  const awayClub = clubMap[norm(awayRaw)] || { name: awayRaw, logoURL: "" };
  const status = String(f.status || "").toLowerCase();
  const hasScores = Number.isFinite(f.scoreA) && Number.isFinite(f.scoreB);
  const score = hasScores ? `${f.scoreA}–${f.scoreB}` : null;

  return (
    <li className="rounded-2xl bg-[#0e1520]/70 ring-1 ring-[#00f6a3]/10 p-5 flex flex-col items-center text-center gap-3">
      <div className="text-sm text-slate-400">
        {f.date || "TBA"} {f.time && `• ${f.time}`}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 w-full max-w-3xl">
        <Team name={cap(homeClub.name)} logoURL={homeClub.logoURL} />
        <div className="text-xl font-bold text-slate-100">{score || "vs"}</div>
        <Team name={cap(awayClub.name)} logoURL={awayClub.logoURL} align="right" />
      </div>

      {(f.venue || f.ground) && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Pin className="text-slate-500" /> {f.venue || f.ground}
        </div>
      )}
    </li>
  );
}

/* ---------- page ---------- */
export default function GuestHomePage() {
  const navigate = useNavigate();
  const [clubMap, setClubMap] = useState({});
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clubFilter, setClubFilter] = useState("all");
  const [roundFilter, setRoundFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "clubs"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const map = Object.fromEntries(
        list.map((c) => {
          const rawLogo = firstDefined(
            c.logoURL,
            c.LogoURL,
            c.logoUrl,
            c.LogoUrl,
            c.logo,
            c.badge,
            c.crest
          );
          return [
            norm(c.id),
            {
              id: norm(c.id),
              name: c.name ?? c.id,
              logoURL: sanitizeUrl(rawLogo),
            },
          ];
        })
      );
      setClubMap(map);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const qy = query(collection(db, `groups/${GROUP_ID}/fixtures`), orderBy("roundNumber", "asc"));
        const snap = await getDocs(qy);
        const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFixtures(sortByDateTime(raw));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const clubOptions = useMemo(() => {
    const ids = Object.keys(clubMap);
    if (ids.length)
      return ids.map((id) => ({ id, label: cap(clubMap[id].name) })).sort((a, b) => a.label.localeCompare(b.label));
    const set = new Set();
    fixtures.forEach((f) => (f.clubIds || []).forEach((cid) => set.add(norm(cid))));
    return [...set].map((id) => ({ id, label: cap(id) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [clubMap, fixtures]);

  const roundOptions = useMemo(() => {
    const rounds = new Set();
    fixtures.forEach((f) => f.roundNumber != null && rounds.add(Number(f.roundNumber)));
    return [...rounds].sort((a, b) => a - b);
  }, [fixtures]);

  const filteredFixtures = useMemo(() => {
    return fixtures.filter((f) => {
      const clubOk =
        clubFilter === "all"
          ? true
          : (f.clubIds || []).map(norm).includes(clubFilter);
      const roundOk =
        roundFilter === "all"
          ? true
          : String(f.roundNumber) === String(roundFilter);
      return clubOk && roundOk;
    });
  }, [fixtures, clubFilter, roundFilter]);

  const groupedByRound = useMemo(() => {
    const map = new Map();
    for (const f of filteredFixtures) {
      const key = f.roundNumber ?? "—";
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, sortByDateTime(list));
    }
    return map;
  }, [filteredFixtures]);

  const sortedRoundKeys = useMemo(() => [...groupedByRound.keys()].sort((a, b) => a - b), [groupedByRound]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f16] via-[#0d111a] to-[#0a0f16] text-slate-100 relative overflow-hidden">
      {/* glow bg */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-gradient-to-br from-[#00f6a3]/10 to-[#00d0ff]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-gradient-to-tr from-[#00d0ff]/10 to-[#00f6a3]/10 rounded-full blur-3xl"></div>
      </div>

      {/* nav */}
      <header className="sticky top-0 z-40 bg-[#111827]/80 backdrop-blur-md border-b border-[#00f6a3]/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-center">
          <nav className="flex gap-1 bg-[#0f172a]/60 ring-1 ring-[#00d0ff]/20 rounded-xl p-1">
            <button
              className="px-4 py-1.5 text-sm rounded-lg bg-gradient-to-r from-[#00f6a3] to-[#00d0ff] text-[#0a0f16] font-semibold shadow-[0_0_10px_rgba(0,255,200,0.2)]"
              aria-current="page"
            >
              Fixtures / Results
            </button>
            <button
              onClick={() => navigate('/ladder')}
              className="px-4 py-1.5 text-sm rounded-lg text-slate-300 hover:text-white hover:bg-[#00d0ff]/10 transition"
            >
              Ladder
            </button>
          </nav>
        </div>
      </header>

      {/* main */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          <div className="flex items-center gap-2 bg-[#0e1520]/70 px-4 py-2 rounded-xl ring-1 ring-[#00f6a3]/10">
            <label className="text-sm text-slate-400">Club</label>
            <select
              value={clubFilter}
              onChange={(e) => setClubFilter(e.target.value)}
              className="bg-[#1a2433]/70 rounded-lg text-sm px-3 py-1.5 text-slate-100 focus:ring-2 focus:ring-[#00d0ff] outline-none"
            >
              <option value="all">All</option>
              {clubOptions.map(({ id, label }) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-[#0e1520]/70 px-4 py-2 rounded-xl ring-1 ring-[#00f6a3]/10">
            <label className="text-sm text-slate-400">Round</label>
            <select
              value={roundFilter}
              onChange={(e) => setRoundFilter(e.target.value)}
              className="bg-[#1a2433]/70 rounded-lg text-sm px-3 py-1.5 text-slate-100 focus:ring-2 focus:ring-[#00f6a3] outline-none"
            >
              <option value="all">All</option>
              {roundOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="bg-[#111827]/60 backdrop-blur-lg ring-1 ring-[#00f6a3]/10 rounded-3xl p-6 text-center">
            <p className="text-slate-400">Loading...</p>
          </div>
        ) : filteredFixtures.length === 0 ? (
          <div className="bg-[#111827]/60 backdrop-blur-lg ring-1 ring-[#00f6a3]/10 rounded-3xl p-6 text-center">
            <p className="text-slate-400">No fixtures found for selected filters.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedRoundKeys.map((key) => (
              <section
                key={key}
                className="bg-[#111827]/60 backdrop-blur-lg ring-1 ring-[#00d0ff]/10 rounded-3xl shadow-[0_0_25px_rgba(0,255,200,0.05)] p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-extrabold bg-gradient-to-r from-[#00f6a3] to-[#00d0ff] bg-clip-text text-transparent">
                    Round {key}
                  </h2>
                  <span className="text-xs text-slate-400">
                    {groupedByRound.get(key)?.length || 0} match(es)
                  </span>
                </div>
                <ul className="space-y-4">
                  {groupedByRound.get(key)?.map((f) => (
                    <FixtureRow key={f.id} f={f} clubMap={clubMap} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
