// src/pages/GuestHomePage.jsx
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
    const isDrive = /(^|\.)drive\.google\.com$/.test(url.hostname);
    if (isDrive) {
      const id = raw.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id");
      if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    }
  } catch {}
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("http://")) return raw.replace(/^http:\/\//, "https://");
  return raw;
};

/** Build a sortable Date from string date "YYYY-MM-DD" and optional time "HH:MM" */
const asDate = (d, t) =>
  new Date(`${String(d || "9999-12-31")}T${String(t || "00:00")}:00`);

/** Stable chronological sort (earliest → latest) */
// Stable chronological sort (earliest → latest)
const sortByDateTime = (arr = []) =>
  (Array.isArray(arr) ? [...arr] : []).sort(
    (a, b) => asDate(a?.date, a?.time) - asDate(b?.date, b?.time)
  );


const Pin = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...props}>
    <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
  </svg>
);

function Initials({ name }) {
  const letters = (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className="w-10 h-10 rounded-full bg-slate-700/40 ring-1 ring-slate-700 flex items-center justify-center text-sm font-semibold text-slate-300">
      {letters || "?"}
    </div>
  );
}

function Team({ name, logoURL, align = "left" }) {
  const Img = () =>
    logoURL ? (
      <img
        src={logoURL}
        alt={name || "Club logo"}
        className="w-10 h-10 rounded-full object-contain bg-slate-700/40 ring-1 ring-slate-700 shrink-0"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = "none";
          const sib = e.currentTarget.nextElementSibling;
          if (sib && sib.dataset.fallback === "true") sib.style.display = "flex";
        }}
      />
    ) : null;

  const Fallback = () => (
    <div data-fallback="true" style={{ display: logoURL ? "none" : "flex" }}>
      <Initials name={name} />
    </div>
  );

  return (
    <div
      className={`min-w-0 inline-flex items-center gap-3 ${
        align === "right" ? "justify-end text-right" : ""
      }`}
    >
      {align !== "right" && (
        <>
          <Img />
          <Fallback />
        </>
      )}
      <div className="font-semibold truncate max-w-[180px] sm:max-w-[220px] md:max-w-[320px]">
        {name}
      </div>
      {align === "right" && (
        <>
          <Img />
          <Fallback />
        </>
      )}
    </div>
  );
}

function FixtureRow({ f, clubMap }) {
  const [homeIdRaw, awayIdRaw] = f.clubIds ?? [];
  const homeClub = clubMap[norm(homeIdRaw)] || { name: homeIdRaw, logoURL: "" };
  const awayClub = clubMap[norm(awayIdRaw)] || { name: awayIdRaw, logoURL: "" };
  const homeName = cap(homeClub.name);
  const awayName = cap(awayClub.name);

  const finished =
    f.status === "finished" ||
    (typeof f.scoreA === "number" && typeof f.scoreB === "number");

  const score =
    finished && Number.isFinite(f.scoreA) && Number.isFinite(f.scoreB)
      ? `${f.scoreA}–${f.scoreB}`
      : null;

  return (
    <li className="rounded-2xl bg-slate-900/60 ring-1 ring-slate-800 p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        {/* Date */}
        <div className="md:w-36">
          <div className="text-xs uppercase tracking-wide text-slate-400">Date</div>
          <div className="font-semibold">
            {String(f.date)}
            {f.time ? ` • ${f.time}` : ""}
          </div>
        </div>

        {/* Teams + Ground */}
        <div className="flex-1">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 w-full">
            <div className="min-w-0 justify-self-end">
              <Team name={homeName} logoURL={homeClub.logoURL} />
            </div>

            <div className="justify-self-center text-center px-2">
              {score ? (
                <div className="text-lg font-extrabold leading-none">{score}</div>
              ) : (
                <div className="text-slate-400 font-semibold leading-none">
                  {f.status === "scheduled" ? "vs." : cap(f.status + " (scores TBA)")}
                </div>
              )}
            </div>

            <div className="min-w-0 justify-self-start">
              <Team name={awayName} logoURL={awayClub.logoURL} align="right" />
            </div>
          </div>

          {(f.venue || f.ground) && (
            <div className="mt-2 flex items-center justify-center gap-2 text-sm text-slate-400">
              <Pin className="text-slate-500" />
              <span>{f.venue || f.ground}</span>
            </div>
          )}
        </div>

        {/* Round */}
        <div className="md:w-24 text-right">
          <div className="text-xs uppercase tracking-wide text-slate-400">Round</div>
          <div className="font-semibold">{f.roundNumber ?? "-"}</div>
        </div>
      </div>
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

  // clubs
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

  // fixtures from group
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, `groups/${GROUP_ID}/fixtures`),
          orderBy("roundNumber", "asc")
        );
        const snap = await getDocs(q);
        const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFixtures(sortByDateTime(raw)); // <— ensure true chronological order
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const clubOptions = useMemo(() => {
    const ids = Object.keys(clubMap);
    if (ids.length) {
      return ids
        .map((id) => ({ id, label: cap(clubMap[id].name) }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    const set = new Set();
    fixtures.forEach((f) => (f.clubIds || []).forEach((cid) => set.add(norm(cid))));
    return [...set]
      .map((id) => ({ id, label: cap(id) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clubMap, fixtures]);

  const roundOptions = useMemo(() => {
    const rounds = new Set();
    fixtures.forEach((f) => {
      if (f.roundNumber !== undefined && f.roundNumber !== null)
        rounds.add(Number(f.roundNumber));
    });
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

  // Group by round, but keep each round section chronologically ordered
const groupedByRound = useMemo(() => {
  const byRound = new Map();

  for (const f of filteredFixtures) {
    const key = f.roundNumber ?? "—";
    const list = byRound.get(key) ?? [];
    list.push(f);
    byRound.set(key, list);
  }

  // ensure each round is sorted by date/time (earliest → latest)
  for (const [key, list] of byRound.entries()) {
    byRound.set(key, sortByDateTime(list));
  }
  return byRound;
}, [filteredFixtures]);


  const sortedRoundKeys = useMemo(() => {
    const keys = [...groupedByRound.keys()];
    return keys.sort((a, b) => Number(a) - Number(b));
  }, [groupedByRound]);

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

      {/* NAV */}
      <header className="bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center">
            <nav className="flex items-center gap-1 rounded-xl bg-slate-800/60 p-1 ring-1 ring-slate-700">
              <button
                className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-700 text-white"
                aria-current="page"
              >
                Fixtures / Results
              </button>
              <button
                className="px-3 py-1.5 text-sm font-semibold rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/70"
                onClick={() => navigate("/ladder")}
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
          <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Club</label>
              <select
                value={clubFilter}
                onChange={(e) => setClubFilter(e.target.value)}
                className="bg-slate-800 text-sm rounded-lg px-3 py-2 ring-1 ring-slate-700 focus:outline-none focus:ring-blue-500"
              >
                <option value="all">All clubs</option>
                {clubOptions.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Round</label>
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

        {/* Cards */}
        {loading ? (
          <div className="max-w-4xl mx-auto bg-slate-800/60 rounded-3xl p-6 shadow-lg ring-1 ring-slate-700">
            <p className="text-slate-400">Loading…</p>
          </div>
        ) : filteredFixtures.length === 0 ? (
          <div className="max-w-4xl mx-auto bg-slate-800/60 rounded-3xl p-6 shadow-lg ring-1 ring-slate-700">
            <p className="text-slate-400">No fixtures match your filters.</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {sortedRoundKeys.map((roundKey) => (
              <section
                key={`round-${roundKey}`}
                className="bg-slate-800/60 rounded-3xl p-6 shadow-lg ring-1 ring-slate-700"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-blue-400">
                    {`Round ${roundKey}`}
                  </h2>
                  <span className="text-xs text-slate-400">
                    {groupedByRound.get(roundKey)?.length ?? 0} match(es)
                  </span>
                </div>

                <ul className="space-y-4">
                  {groupedByRound.get(roundKey)?.map((f) => (
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
