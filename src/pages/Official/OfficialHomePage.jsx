// src/pages/Official/OfficialHomePage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
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

/* ---------- config ---------- */
const GROUP_ID = "groupA-2025";

/* ---------- helpers ---------- */
const norm = (s) => (s ? String(s).trim().toLowerCase() : "");
const cap = (s) =>
  typeof s === "string" && s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const asDate = (d, t) =>
  new Date(`${String(d || "9999-12-31")}T${String(t || "23:59")}:00`);
const sortByDateTime = (arr = []) =>
  (Array.isArray(arr) ? [...arr] : []).sort(
    (a, b) => asDate(a?.date, a?.time) - asDate(b?.date, b?.time)
  );
const firstDefined = (...xs) =>
  xs.find((x) => x !== undefined && x !== null && String(x).trim() !== "");
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

/* ---------- small subcomponents ---------- */
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
    <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#14202f]/70 ring-1 ring-[#00f6a3]/20 flex items-center justify-center text-xs md:text-sm font-semibold text-emerald-300">
      {letters || "?"}
    </div>
  );
}

function Team({ name, logoURL, align = "left" }) {
  const Img = () =>
    logoURL ? (
      <img
        src={logoURL}
        alt={name}
        className="w-9 h-9 md:w-10 md:h-10 rounded-full object-contain bg-[#101822]/60 ring-1 ring-[#00d0ff]/20 shrink-0"
        loading="lazy"
        onError={(e) => (e.currentTarget.style.display = "none")}
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
      <div className="font-semibold truncate text-slate-100 max-w-[180px] sm:max-w-[240px] md:max-w-[320px]">
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

/* ---------- main page ---------- */
export default function OfficialHomePage() {
  const [clubMap, setClubMap] = useState({});
  const [fixtures, setFixtures] = useState([]);
  const [venues, setVenues] = useState([]);
  const [modal, setModal] = useState({ open: false });
  const [details, setDetails] = useState({ open: false });
  const scoreARef = useRef(null);

  /* auth guard */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) window.location.href = "/";
    });
    return () => unsub();
  }, []);

  /* clubs */
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
            c.badge
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

  /* fixtures listener */
  useEffect(() => {
    const qy = query(
      collection(db, `groups/${GROUP_ID}/fixtures`),
      orderBy("roundNumber", "asc")
    );
    const unsub = onSnapshot(qy, (snap) => {
      const raw = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        _path: ["groups", GROUP_ID, "fixtures", d.id],
      }));
      setFixtures(sortByDateTime(raw));
    });
    return () => unsub();
  }, []);

  /* venues */
  useEffect(() => {
    (async () => {
      const g = await getDoc(doc(db, "groups", GROUP_ID));
      const list = Array.isArray(g.data()?.venues) ? g.data().venues : [];
      if (list.length) setVenues(list);
    })();
  }, []);

  const hasScores = (f) => Number.isFinite(f?.scoreA) && Number.isFinite(f?.scoreB);
  const needsScore = (f) =>
    (f?.status === "finished" || f?.status === "completed") && !hasScores(f);

  const upcoming = useMemo(() => fixtures.filter((f) => !hasScores(f)), [fixtures]);
  const past = useMemo(() => fixtures.filter(hasScores), [fixtures]);

  const groupByRound = (arr) => {
    const byRound = new Map();
    for (const f of arr) {
      const key = f.roundNumber ?? "—";
      const list = byRound.get(key) ?? [];
      list.push(f);
      byRound.set(key, sortByDateTime(list));
    }
    return byRound;
  };

  const upGrouped = useMemo(() => groupByRound(upcoming), [upcoming]);
  const pastGrouped = useMemo(() => groupByRound(past), [past]);
  const upRoundKeys = useMemo(
    () => [...upGrouped.keys()].sort((a, b) => Number(a) - Number(b)),
    [upGrouped]
  );
  const pastRoundKeys = useMemo(
    () => [...pastGrouped.keys()].sort((a, b) => Number(a) - Number(b)),
    [pastGrouped]
  );

  /* helpers */
  const clubName = (id) => clubMap[norm(id)]?.name ?? cap(id ?? "");
  const openEdit = (fixture) =>
    setModal({ open: true, fixture, mode: "edit", scoreA: fixture.scoreA ?? "", scoreB: fixture.scoreB ?? "" });
  const openConfirm = (fixture) =>
    setModal({ open: true, fixture, mode: "confirm", scoreA: fixture.scoreA ?? "", scoreB: fixture.scoreB ?? "" });
  const closeModal = () => setModal({ open: false });

  const saveScores = async () => {
    const { fixture, scoreA, scoreB } = modal;
    if (!fixture) return;
    const a = Number(scoreA), b = Number(scoreB);
    if (!Number.isInteger(a) || !Number.isInteger(b)) return;
    await updateDoc(doc(db, ...fixture._path), {
      scoreA: a,
      scoreB: b,
      status: "finished",
    });
    closeModal();
  };

  /* details modal logic */
  const openDetails = (fixture) =>
    setDetails({
      open: true,
      fixture,
      date: fixture.date || "",
      time: fixture.time || "",
      status: String(fixture.status || "scheduled").toLowerCase(),
      chosenVenue: fixture.venue || "",
      customVenue: "",
    });
  const closeDetails = () => setDetails({ open: false });

  const saveDetails = async () => {
    const f = details.fixture;
    if (!f) return;
    const date = String(details.date || "").trim();
    const time = String(details.time || "").trim();
    const status = String(details.status || "scheduled").toLowerCase();
    const venueValue =
      details.chosenVenue === "___OTHER___"
        ? (details.customVenue || "").trim()
        : (details.chosenVenue || "").trim();
    await updateDoc(doc(db, ...f._path), {
      date: date || null,
      time: time || null,
      status,
      ...(venueValue && { venue: venueValue }),
    });
    closeDetails();
  };

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f16] via-[#0d111a] to-[#0a0f16] text-slate-100 relative overflow-hidden">
      {/* background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-gradient-to-br from-[#00f6a3]/10 to-[#00d0ff]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-gradient-to-tr from-[#00d0ff]/10 to-[#00f6a3]/10 rounded-full blur-3xl"></div>
      </div>

      {/* header */}
      <header className="sticky top-0 z-40 bg-[#111827]/80 backdrop-blur-md border-b border-[#00f6a3]/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-row-reverse">
          <button
            onClick={() => signOut(auth)}
            className="px-3 py-1.5 text-sm rounded-lg bg-gradient-to-r from-[#00f6a3] to-[#00d0ff] text-[#0a0f16] font-semibold hover:brightness-110 shadow-[0_0_8px_rgba(0,255,200,0.3)] transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* main */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-10 space-y-10">
        <SectionCard
          title="Upcoming Fixtures"
          group={upGrouped}
          roundKeys={upRoundKeys}
          clubMap={clubMap}
          showScore={false}
          onEdit={openEdit}
          onConfirm={openConfirm}
          onDetails={openDetails}
          needsScore={needsScore}
        />
        <SectionCard
          title="Past Fixtures"
          group={pastGrouped}
          roundKeys={pastRoundKeys}
          clubMap={clubMap}
          showScore
          onEdit={openEdit}
          onConfirm={openConfirm}
          onDetails={openDetails}
          needsScore={needsScore}
        />
      </main>

      {/* Modals */}
      {modal.open && (
        <Modal onClose={closeModal}>
          {modal.mode === "confirm" ? (
            <div className="text-center space-y-5">
              <h3 className="text-lg font-semibold text-emerald-400">
                Confirm Match Completion
              </h3>
              <p className="text-slate-300">
                {clubName(modal.fixture?.clubIds?.[0])} vs{" "}
                {clubName(modal.fixture?.clubIds?.[1])}
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setModal({ ...modal, mode: "edit" })}
                  className="px-4 py-2 rounded bg-gradient-to-r from-[#00f6a3] to-[#00d0ff] text-[#0a0f16] font-semibold hover:brightness-110"
                >
                  Enter Score
                </button>
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded bg-[#1f2937] text-slate-200 hover:bg-[#273548]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-emerald-400 text-center">
                Enter Final Score
              </h3>
              <div className="flex justify-center gap-4">
                <input
                  ref={scoreARef}
                  type="number"
                  value={modal.scoreA}
                  onChange={(e) =>
                    setModal({ ...modal, scoreA: e.target.value })
                  }
                  className="w-20 text-center rounded bg-[#1a2433]/70 text-slate-100 focus:ring-2 focus:ring-[#00f6a3] outline-none"
                />
                <span className="self-center text-xl font-bold">–</span>
                <input
                  type="number"
                  value={modal.scoreB}
                  onChange={(e) =>
                    setModal({ ...modal, scoreB: e.target.value })
                  }
                  className="w-20 text-center rounded bg-[#1a2433]/70 text-slate-100 focus:ring-2 focus:ring-[#00d0ff] outline-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={saveScores}
                  className="px-5 py-2 rounded bg-gradient-to-r from-[#00f6a3] to-[#00d0ff] text-[#0a0f16] font-semibold"
                >
                  Save
                </button>
                <button
                  onClick={closeModal}
                  className="px-5 py-2 rounded bg-[#1f2937] text-slate-200 hover:bg-[#273548]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {details.open && (
        <Modal onClose={closeDetails}>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-cyan-400 text-center">
              Edit Match Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="date"
                value={details.date}
                onChange={(e) => setDetails({ ...details, date: e.target.value })}
                className="bg-[#1a2433]/70 rounded px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-[#00f6a3] outline-none"
              />
              <input
                type="time"
                value={details.time}
                onChange={(e) => setDetails({ ...details, time: e.target.value })}
                className="bg-[#1a2433]/70 rounded px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-[#00d0ff] outline-none"
              />
            </div>
            <select
              value={details.status}
              onChange={(e) => setDetails({ ...details, status: e.target.value })}
              className="w-full bg-[#1a2433]/70 rounded px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-[#00f6a3]"
            >
              <option value="scheduled">Scheduled</option>
              <option value="postponed">Postponed</option>
              <option value="finished">Finished</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={details.chosenVenue}
              onChange={(e) => setDetails({ ...details, chosenVenue: e.target.value })}
              className="w-full bg-[#1a2433]/70 rounded px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-[#00d0ff]"
            >
              <option value="">Select Venue</option>
              {venues.map((v) => (
                <option key={v}>{v}</option>
              ))}
              <option value="___OTHER___">Other...</option>
            </select>
            {details.chosenVenue === "___OTHER___" && (
              <input
                type="text"
                value={details.customVenue}
                onChange={(e) =>
                  setDetails({ ...details, customVenue: e.target.value })
                }
                placeholder="Enter custom venue"
                className="w-full bg-[#1a2433]/70 rounded px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-[#00f6a3] outline-none"
              />
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={saveDetails}
                className="px-5 py-2 rounded bg-gradient-to-r from-[#00f6a3] to-[#00d0ff] text-[#0a0f16] font-semibold"
              >
                Save
              </button>
              <button
                onClick={closeDetails}
                className="px-5 py-2 rounded bg-[#1f2937] text-slate-200 hover:bg-[#273548]"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- subcomponents ---------- */
function SectionCard({ title, group, roundKeys, clubMap, showScore, onEdit, onConfirm, onDetails, needsScore }) {
  return (
    <section className="bg-[#111827]/60 backdrop-blur-lg ring-1 ring-[#00d0ff]/10 rounded-3xl shadow-[0_0_20px_rgba(0,255,200,0.05)] p-6">
      <h2 className="text-2xl font-extrabold mb-6 bg-gradient-to-r from-[#00f6a3] to-[#00d0ff] bg-clip-text text-transparent">
        {title}
      </h2>
      {roundKeys.length === 0 ? (
        <p className="text-slate-400 text-center py-6">No fixtures yet.</p>
      ) : (
        <div className="space-y-8">
          {roundKeys.map((key) => (
            <div key={key}>
              <h3 className="text-lg font-semibold text-cyan-300 mb-3">
                Round {key}
              </h3>
              <ul className="space-y-4">
                {group.get(key)?.map((f) => (
                  <FixtureRow
                    key={f.id}
                    f={f}
                    clubMap={clubMap}
                    showScore={showScore}
                    needsScore={needsScore?.(f)}
                    onEnterScore={() => onEdit(f)}
                    onConfirmFinished={() => onConfirm(f)}
                    onChangeDetails={() => onDetails(f)}
                    onEditScore={() => onEdit(f)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111827] w-full max-w-md rounded-2xl p-6 shadow-[0_0_25px_rgba(0,255,200,0.1)] ring-1 ring-[#00f6a3]/10 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-slate-400 hover:text-white text-lg font-bold"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

function FixtureRow({ f, clubMap, showScore, needsScore, onEnterScore, onConfirmFinished, onEditScore, onChangeDetails }) {
  const [home, away] = f.clubIds ?? [];
  const homeClub = clubMap[norm(home)] || {};
  const awayClub = clubMap[norm(away)] || {};
  const scored = showScore && Number.isFinite(f.scoreA) && Number.isFinite(f.scoreB);
  const score = scored ? `${f.scoreA}–${f.scoreB}` : null;
  return (
    <li className="rounded-2xl bg-[#0e1520]/70 ring-1 ring-[#00f6a3]/10 p-5 flex flex-col items-center text-center gap-4">
      <div className="text-sm text-slate-400">
        {f.date || "TBA"} {f.time && `• ${f.time}`}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 w-full max-w-3xl">
        <Team name={homeClub.name} logoURL={homeClub.logoURL} />
        <div className="text-2xl font-bold">{score || "vs"}</div>
        <Team name={awayClub.name} logoURL={awayClub.logoURL} align="right" />
      </div>
      {f.venue && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Pin className="text-slate-500" /> {f.venue}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={onChangeDetails}
          className="px-4 py-2 rounded bg-[#1f2937] hover:bg-[#273548] text-slate-200"
        >
          Change Details
        </button>
        {showScore ? (
          <button
            onClick={onEditScore}
            className="px-4 py-2 rounded bg-gradient-to-r from-[#00f6a3] to-[#00d0ff] text-[#0a0f16] font-semibold"
          >
            Update Score
          </button>
        ) : (
          <button
            onClick={needsScore ? onEnterScore : onConfirmFinished}
            className="px-4 py-2 rounded bg-gradient-to-r from-[#00f6a3] to-[#00d0ff] text-[#0a0f16] font-semibold"
          >
            {needsScore ? "Enter Score" : "Mark Finished"}
          </button>
        )}
      </div>
    </li>
  );
}
