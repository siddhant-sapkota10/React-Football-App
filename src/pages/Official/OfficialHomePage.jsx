import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

/* ---------------------------- CONFIG ---------------------------- */
const GROUP_ID = "groupA-2025"; // change if your group document id differs

/* --------------------------- HELPERS ---------------------------- */
const norm = (s) => (s ? String(s).trim().toLowerCase() : "");
const cap = (s) =>
  typeof s === "string" && s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const firstDefined = (...xs) =>
  xs.find((x) => x !== undefined && x !== null && x !== "");

// Build a sortable Date from YYYY-MM-DD and HH:mm (tolerant fallback)
const asDate = (d, t) => {
  const safe = `${String(d || "9999-12-31")} ${String(t || "23:59")}`;
  const dt = new Date(safe.replace(" ", "T"));
  return Number.isNaN(+dt) ? new Date("9999-12-31T23:59") : dt;
};

// stable chronological sort (earliest → latest)
const sortByDateTime = (arr) =>
  [...arr].sort((a, b) => asDate(a.date, a.time) - asDate(b.date, b.time));

const Pin = (props) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" {...props}>
    <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"/>
  </svg>
);

/* --------------------------- PAGE ------------------------------ */
export default function OfficialHomePage() {
  const [user, setUser] = useState(null);

  const [fixtures, setFixtures] = useState([]);
  const [clubsById, setClubsById] = useState({});
  const [venueOptions, setVenueOptions] = useState([]); // from groups/{GROUP_ID}.venues

  // modal
  const [modal, setModal] = useState({
    open: false,
    fixture: null,
    mode: "confirm", // 'confirm' | 'edit' | 'venue'
    scoreA: "",
    scoreB: "",
    venue: "",           // text value used when mode==='venue' && selectedVenue === 'other'
    selectedVenue: "",   // one of venueOptions OR 'other'
  });

  /* ---- auth guard ---- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) window.location.href = "/";
      else setUser(u);
    });
    return () => unsub();
  }, []);

  /* ---- group venues ---- */
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "groups", GROUP_ID));
        const data = snap.exists() ? snap.data() : {};
        const arr = Array.isArray(data.venues) ? data.venues : [];
        // Keep unique, stable order
        const unique = [...new Set(arr.map((v) => String(v || "").trim()))].filter(Boolean);
        setVenueOptions(unique);
      } catch (e) {
        console.warn("Failed to load group venues:", e);
        setVenueOptions([]);
      }
    })();
  }, []);

  /* ---- clubs ---- */
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "clubs"));
        const map = {};
        for (const d of snap.docs) {
          const c = d.data();
          const logo =
            firstDefined(
              c.logoURL,
              c.LogoURL,
              c.logoUrl,
              c.LogoUrl,
              c.logo,
              c.crest
            ) || "";
          map[norm(d.id)] = {
            id: norm(d.id),
            name: c.name ?? cap(d.id),
            logoURL: logo,
          };
        }
        setClubsById(map);
      } catch (e) {
        console.warn("Failed to load clubs:", e);
      }
    })();
  }, []);

  /* ---- fixtures (root, then fallback to groups/{GROUP_ID}/fixtures) ---- */
  useEffect(() => {
    let cleanup = () => {};
    let triedFallback = false;

    const listenAt = (path) => {
      const qy = query(collection(db, ...path), orderBy("roundNumber", "asc"));
      return onSnapshot(
        qy,
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            _path: [...path, d.id],
          }));
          setFixtures(list);
        },
        (err) => {
          console.error(`[fixtures error @/${path.join("/")}]`, err);
          if (!triedFallback) {
            triedFallback = true;
            cleanup = listenAt(["groups", GROUP_ID, "fixtures"]);
          } else {
            setFixtures([]);
          }
        }
      );
    };

    cleanup = listenAt(["fixtures"]);
    const timer = setTimeout(() => {
      if (!triedFallback && fixtures.length === 0) {
        triedFallback = true;
        cleanup();
        cleanup = listenAt(["groups", GROUP_ID, "fixtures"]);
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      cleanup && cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clubName = (id) => clubsById[norm(id)]?.name ?? cap(id ?? "");
  const clubLogo = (id) => clubsById[norm(id)]?.logoURL ?? "";

  const isScored = (f) =>
    Number.isFinite(f?.scoreA) && Number.isFinite(f?.scoreB);

  const upcoming = useMemo(() => fixtures.filter((f) => !isScored(f)), [fixtures]);
  const past = useMemo(() => fixtures.filter(isScored), [fixtures]);

  // Group an array of fixtures by round and sort rounds asc + fixtures by datetime
  const groupByRound = (arr) => {
    const map = new Map();
    arr.forEach((f) => {
      const key = f.roundNumber ?? "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    });
    for (const [k, list] of map) map.set(k, sortByDateTime(list));
    return [...map.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  };

  const upcomingByRound = useMemo(() => groupByRound(upcoming), [upcoming]);
  const pastByRound = useMemo(() => groupByRound(past), [past]);

  /* ---- modal helpers ---- */
  const openConfirm = (fixture) =>
    setModal({
      open: true,
      fixture,
      mode: "confirm",
      scoreA: fixture.scoreA ?? "",
      scoreB: fixture.scoreB ?? "",
      selectedVenue: "",
      venue: fixture.venue ?? fixture.ground ?? "",
    });

  const openEdit = (fixture) =>
    setModal({
      open: true,
      fixture,
      mode: "edit",
      scoreA: fixture.scoreA ?? "",
      scoreB: fixture.scoreB ?? "",
      selectedVenue: "",
      venue: fixture.venue ?? fixture.ground ?? "",
    });

  const openVenue = (fixture) => {
    const currentVenue = String(firstDefined(fixture.venue, fixture.ground, "")).trim();
    const isListed = venueOptions.includes(currentVenue);
    setModal({
      open: true,
      fixture,
      mode: "venue",
      scoreA: fixture.scoreA ?? "",
      scoreB: fixture.scoreB ?? "",
      selectedVenue: isListed ? currentVenue : "other",
      venue: isListed ? "" : currentVenue, // if not listed, prefill text input
    });
  };

  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  /* ---- save back: scores ---- */
  const saveScores = async () => {
    const { fixture, scoreA, scoreB } = modal;
    if (!fixture || !Array.isArray(fixture._path)) return;
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return;
    try {
      await updateDoc(doc(db, ...fixture._path), {
        scoreA: a,
        scoreB: b,
        status: "finished",
      });
      closeModal();
    } catch (err) {
      console.error("Failed to update fixture:", fixture._path, err);
      alert("Could not save score (check Firestore rules). See console for details.");
    }
  };

  /* ---- save back: venue with double-booking guard ---- */
  const saveVenue = async () => {
    const { fixture, selectedVenue, venue } = modal;
    if (!fixture || !Array.isArray(fixture._path)) return;

    // Decide final venue string
    const finalVenue =
      selectedVenue === "other"
        ? String(venue || "").trim()
        : String(selectedVenue || "").trim();

    if (!finalVenue) {
      alert("Please choose a venue or enter one.");
      return;
    }

    // Compute "used on this date" set (excluding current fixture)
    const usedOnDate = new Set(
      fixtures
        .filter((f) => f.date === fixture.date && f.id !== fixture.id)
        .map((f) => String(firstDefined(f.venue, f.ground, "")).trim())
        .filter(Boolean)
    );

    // If finalVenue is already used that day -> block
    if (usedOnDate.has(finalVenue)) {
      alert(`“${finalVenue}” is already booked on ${fixture.date}. Please choose another venue.`);
      return;
    }

    try {
      await updateDoc(doc(db, ...fixture._path), { venue: finalVenue });
      closeModal();
    } catch (err) {
      console.error("Failed to update venue:", fixture._path, err);
      alert("Could not update venue (check Firestore rules). See console for details.");
    }
  };

  /* ---- compute disabled venues (same date) for venue modal ---- */
  const venuesInUseForDate = useMemo(() => {
    if (!modal.open || modal.mode !== "venue" || !modal.fixture) return new Set();
    const d = modal.fixture.date;
    const currentId = modal.fixture.id;
    return new Set(
      fixtures
        .filter((f) => f.date === d && f.id !== currentId)
        .map((f) => String(firstDefined(f.venue, f.ground, "")).trim())
        .filter(Boolean)
    );
  }, [modal.open, modal.mode, modal.fixture, fixtures]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* top bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-cyan-400 to-green-400">
            SAPKOTIX
          </h1>
          <button
            onClick={() => signOut(auth)}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 ring-1 ring-slate-700"
          >
            Logout
          </button>
        </div>
      </header>

      {/* main */}
      <main className={`max-w-6xl mx-auto px-4 py-8 ${modal.open ? "blur-sm" : ""}`}>
        {/* UPCOMING (grouped by round) */}
        <SectionCard title="Your Fixtures" className="space-y-5">
          {upcomingByRound.length === 0 ? (
            <EmptyRow text="No upcoming fixtures." />
          ) : (
            upcomingByRound.map(([roundKey, list]) => (
              <RoundCard
                key={`up-r-${roundKey}`}
                title={`Round ${roundKey}`}
                count={list.length}
              >
                {list.map((f) => (
                  <FixtureRow
                    key={f.id}
                    f={f}
                    clubName={clubName}
                    clubLogo={clubLogo}
                    showScore={false}
                    primaryLabel="Update Score"
                    onPrimary={() => openConfirm(f)}
                    secondaryLabel="Change Venue"
                    onSecondary={() => openVenue(f)}
                  />
                ))}
              </RoundCard>
            ))
          )}
        </SectionCard>

        {/* PAST (grouped by round) */}
        <SectionCard title="Past Fixtures" className="mt-6 space-y-5">
          {pastByRound.length === 0 ? (
            <EmptyRow text="No past fixtures yet." />
          ) : (
            pastByRound.map(([roundKey, list]) => (
              <RoundCard
                key={`past-r-${roundKey}`}
                title={`Round ${roundKey}`}
                count={list.length}
              >
                {list.map((f) => (
                  <FixtureRow
                    key={f.id}
                    f={f}
                    clubName={clubName}
                    clubLogo={clubLogo}
                    showScore
                    primaryLabel="Edit Score"
                    onPrimary={() => openEdit(f)}
                  />
                ))}
              </RoundCard>
            ))
          )}
        </SectionCard>
      </main>

      {/* MODAL */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 w-full max-w-md rounded-2xl p-6 shadow-xl ring-1 ring-slate-700">
            {/* Confirm -> Edit score prompt */}
            {modal.mode === "confirm" && (
              <>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">
                  Is this game finished?
                </h3>
                <p className="text-slate-300 mb-6">
                  {clubName(modal.fixture?.clubIds?.[0])} vs{" "}
                  {clubName(modal.fixture?.clubIds?.[1])} — Round{" "}
                  {modal.fixture?.roundNumber}
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setModal((m) => ({ ...m, mode: "edit" }))}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium"
                  >
                    Yes, enter score
                  </button>
                  <button
                    onClick={closeModal}
                    className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded font-medium"
                  >
                    No
                  </button>
                </div>
              </>
            )}

            {/* Edit final score */}
            {modal.mode === "edit" && (
              <>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">
                  Enter final score
                </h3>
                <p className="text-slate-300 mb-4">
                  {clubName(modal.fixture?.clubIds?.[0])} vs{" "}
                  {clubName(modal.fixture?.clubIds?.[1])} — Round{" "}
                  {modal.fixture?.roundNumber}
                </p>
                <div className="flex justify-center gap-4 mb-6">
                  <input
                    type="number"
                    className="bg-slate-700 p-2 rounded w-24 text-center"
                    value={modal.scoreA}
                    onChange={(e) =>
                      setModal((m) => ({ ...m, scoreA: e.target.value }))
                    }
                    placeholder="Team A"
                  />
                  <span className="self-center text-slate-400 font-semibold">–</span>
                  <input
                    type="number"
                    className="bg-slate-700 p-2 rounded w-24 text-center"
                    value={modal.scoreB}
                    onChange={(e) =>
                      setModal((m) => ({ ...m, scoreB: e.target.value }))
                    }
                    placeholder="Team B"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={saveScores}
                    className="bg-green-600 hover:bg-green-700 px-5 py-2 rounded font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={closeModal}
                    className="bg-red-600 hover:bg-red-700 px-5 py-2 rounded font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* Change venue (with select + “Other…”) */}
            {modal.mode === "venue" && (
              <>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">
                  Change venue
                </h3>
                <p className="text-slate-300 mb-4">
                  {clubName(modal.fixture?.clubIds?.[0])} vs{" "}
                  {clubName(modal.fixture?.clubIds?.[1])} — Round{" "}
                  {modal.fixture?.roundNumber}
                  <br />
                  <span className="text-slate-400 text-sm">
                    Date: {modal.fixture?.date ?? "TBA"}
                  </span>
                </p>

                <label className="block text-sm text-slate-300 mb-2">Venue</label>
                <select
                  className="w-full bg-slate-700 p-2 rounded mb-3 ring-1 ring-slate-600"
                  value={modal.selectedVenue}
                  onChange={(e) =>
                    setModal((m) => ({ ...m, selectedVenue: e.target.value }))
                  }
                >
                  <option value="" disabled>
                    Select a venue
                  </option>
                  {venueOptions.map((v) => {
                    const used = venuesInUseForDate.has(String(v).trim());
                    return (
                      <option key={v} value={v} disabled={used}>
                        {v} {used ? "— (in use this date)" : ""}
                      </option>
                    );
                  })}
                  <option value="other">Other…</option>
                </select>

                {modal.selectedVenue === "other" && (
                  <>
                    <label className="block text-sm text-slate-300 mb-2">
                      Enter custom venue
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-700 p-2 rounded ring-1 ring-slate-600"
                      placeholder="e.g., Riverside Stadium"
                      value={modal.venue}
                      onChange={(e) =>
                        setModal((m) => ({ ...m, venue: e.target.value }))
                      }
                    />
                  </>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={saveVenue}
                    className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={closeModal}
                    className="bg-slate-700 hover:bg-slate-600 px-5 py-2 rounded font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------- PRESENTATIONAL PARTS --------------------- */

function SectionCard({ title, children, className = "" }) {
  return (
    <section className={`max-w-4xl mx-auto bg-slate-800/60 rounded-3xl ring-1 ring-slate-700 p-5 md:p-6 shadow-lg ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold text-blue-400">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function RoundCard({ title, count, children }) {
  return (
    <div className="bg-slate-900/55 rounded-2xl ring-1 ring-slate-800 p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-slate-400">{count} match(es)</span>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function EmptyRow({ text }) {
  return (
    <div className="rounded-2xl bg-slate-900/50 ring-1 ring-slate-800 p-4 text-slate-400">
      {text}
    </div>
  );
}

function TeamSide({ name, logoURL, align = "left" }) {
  return (
    <div className={`min-w-0 inline-flex items-center gap-3 ${align === "right" ? "justify-end text-right" : ""}`}>
      {align !== "right" && (
        <img
          src={logoURL || ""}
          alt={name}
          className={`w-10 h-10 rounded-full object-contain bg-slate-700/40 ring-1 ring-slate-700 ${logoURL ? "" : "opacity-0"}`}
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      <div className="font-semibold truncate max-w-[220px] md:max-w-[320px]">{name}</div>
      {align === "right" && (
        <img
          src={logoURL || ""}
          alt={name}
          className={`w-10 h-10 rounded-full object-contain bg-slate-700/40 ring-1 ring-slate-700 ${logoURL ? "" : "opacity-0"}`}
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
    </div>
  );
}

function RoundPill({ children }) {
  return (
    <span className="px-3 py-1 text-[11px] font-semibold rounded-full bg-slate-700 text-slate-200 ring-1 ring-slate-600 whitespace-nowrap">
      {children}
    </span>
  );
}

/** Fixture row with aligned spacing */
function FixtureRow({
  f,
  clubName,
  clubLogo,
  showScore,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}) {
  const [homeId, awayId] = f.clubIds ?? [];
  const home = { name: clubName(homeId), logoURL: clubLogo(homeId) };
  const away = { name: clubName(awayId), logoURL: clubLogo(awayId) };

  const score =
    showScore && Number.isFinite(f.scoreA) && Number.isFinite(f.scoreB)
      ? { a: f.scoreA, b: f.scoreB }
      : null;

  return (
    <div className="rounded-2xl bg-slate-900/60 ring-1 ring-slate-800 p-4 md:p-5">
      <div className="grid [grid-template-columns:140px_1fr_260px] items-center gap-4 md:gap-6">
        {/* DATE */}
        <div className="w-[140px]">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Date</div>
          <div className="font-semibold leading-tight">
            {f.date || "TBA"}
            {f.time ? (
              <>
                <br />
                <span className="text-slate-300">{f.time}</span>
              </>
            ) : null}
          </div>
        </div>

        {/* TEAMS + SCORE + VENUE */}
        <div className="min-w-0">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="min-w-0 justify-self-end">
              <TeamSide name={home.name} logoURL={home.logoURL} />
            </div>
            <div className="justify-self-center text-center px-2">
              {score ? (
                <div className="text-lg md:text-xl font-extrabold leading-none">
                  {score.a} <span className="text-slate-400">–</span> {score.b}
                </div>
              ) : (
                <div className="text-slate-400 font-semibold leading-none">vs.</div>
              )}
            </div>
            <div className="min-w-0 justify-self-start">
              <TeamSide name={away.name} logoURL={away.logoURL} align="right" />
            </div>
          </div>

          {(f.venue || f.ground) && (
            <div className="mt-2 flex justify-self-center items-center gap-2 text-sm text-slate-400">
              <Pin className="text-slate-500" />
              <span className="truncate">{f.venue || f.ground}</span>
            </div>
          )}
        </div>

        {/* RIGHT CONTROLS */}
        <div className="w-[260px] flex items-center justify-end gap-3">
          <RoundPill>ROUND {f.roundNumber ?? "?"}</RoundPill>
          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              className="px-3 md:px-3.5 py-2 rounded-xl font-medium bg-slate-700 hover:bg-slate-600 text-slate-100 ring-1 ring-slate-600"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            onClick={onPrimary}
            className="px-3 md:px-4 py-2 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white ring-1 ring-blue-500/40"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
