import { useEffect, useMemo, useState } from 'react'
import { db } from '../../firebase'
import { collection, getDocs } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'

// --- Helpers --------------------------------------------------------------
const norm = (s) => (s ? String(s).trim().toLowerCase() : '')
const capitalize = (s) =>
  s && typeof s === 'string' ? s.charAt(0).toUpperCase() + s.slice(1) : ''

const Pin = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...props}>
    <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"/>
  </svg>
)

function Initials({ name }) {
  const letters = (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return (
    <div className="w-10 h-10 rounded-full bg-slate-700/40 ring-1 ring-slate-700 flex items-center justify-center text-sm font-semibold text-slate-300">
      {letters || '?'}
    </div>
  )
}

function Team({ name, logoURL, align = 'left' }) {
  const Img = () =>
    logoURL ? (
      <img
        src={logoURL}
        alt={name || 'Club logo'}
        className="w-10 h-10 rounded-full object-contain bg-slate-700/40 ring-1 ring-slate-700 shrink-0"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
          const sib = e.currentTarget.nextElementSibling
          if (sib && sib.dataset.fallback === 'true') sib.style.display = 'flex'
        }}
      />
    ) : null

  const Fallback = () => (
    <div data-fallback="true" style={{ display: logoURL ? 'none' : 'flex' }}>
      <Initials name={name} />
    </div>
  )

  return (
    <div className={`inline-flex items-center gap-3 ${align === 'right' ? 'justify-end text-right' : ''}`}>
      {align !== 'right' && (
        <>
          <Img />
          <Fallback />
        </>
      )}
      <div className="font-semibold">{name}</div>
      {align === 'right' && (
        <>
          <Img />
          <Fallback />
        </>
      )}
    </div>
  )
}

// --- Page -----------------------------------------------------------------
export default function GuestHomePage() {
  const navigate = useNavigate()
  const [clubMap, setClubMap] = useState({})
  const [fixtures, setFixtures] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [clubFilter, setClubFilter] = useState('all')
  const [roundFilter, setRoundFilter] = useState('all')

  // Load clubs
  useEffect(() => {
    ;(async () => {
      const snap = await getDocs(collection(db, 'clubs'))
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const map = Object.fromEntries(
        list.map((c) => [
          norm(c.id),
          { id: norm(c.id), name: c.name ?? c.id, logoURL: c.LogoURL ?? c.logoURL ?? '' },
        ])
      )
      setClubMap(map)
    })()
  }, [])

  // Load fixtures
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const snap = await getDocs(collection(db, 'fixtures'))
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setFixtures(list)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Options
  const clubOptions = useMemo(() => {
    const ids = Object.keys(clubMap)
    if (ids.length) {
      return ids.map((id) => ({ id, label: capitalize(clubMap[id].name) }))
                .sort((a, b) => a.label.localeCompare(b.label))
    }
    const set = new Set()
    fixtures.forEach((f) => (f.clubIds || []).forEach((cid) => set.add(norm(cid))))
    return [...set].map((id) => ({ id, label: capitalize(id) }))
                   .sort((a, b) => a.label.localeCompare(b.label))
  }, [clubMap, fixtures])

  const roundOptions = useMemo(() => {
    const rounds = new Set()
    fixtures.forEach((f) => {
      if (f.roundNumber !== undefined && f.roundNumber !== null)
        rounds.add(Number(f.roundNumber))
    })
    return [...rounds].sort((a, b) => a - b)
  }, [fixtures])

  // Filtered fixtures
  const filteredFixtures = useMemo(() => {
    return fixtures.filter((f) => {
      const clubOk =
        clubFilter === 'all'
          ? true
          : (f.clubIds || []).map(norm).includes(clubFilter)
      const roundOk =
        roundFilter === 'all'
          ? true
          : String(f.roundNumber) === String(roundFilter)
      return clubOk && roundOk
    })
  }, [fixtures, clubFilter, roundFilter])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 text-white">

      {/* TOP STICKY BAR: SAPKOTIX centered */}
      <div className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="py-3 flex items-center justify-center">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-cyan-400 to-green-400">
              SAPKOTIX
            </h1>
          </div>
        </div>
      </div>

      {/* NAVBAR (now where SAPKOTIX used to be), centered */}
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
                onClick={() => navigate('/ladder')}
              >
                Ladders
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* Filters centered above fixtures card */}
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
                  <option key={id} value={id}>{label}</option>
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
                  <option key={r} value={String(r)}>{r}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Fixtures card */}
        <div className="max-w-4xl mx-auto bg-slate-800/60 rounded-3xl p-6 shadow-lg ring-1 ring-slate-700">
          <h2 className="text-xl font-bold mb-4 text-blue-400">Fixtures/Results</h2>

          {loading ? (
            <p className="text-slate-400">Loading…</p>
          ) : filteredFixtures.length === 0 ? (
            <p className="text-slate-400">No fixtures match your filters.</p>
          ) : (
            <ul className="space-y-4">
              {filteredFixtures.map((f) => {
                const [homeIdRaw, awayIdRaw] = f.clubIds ?? []
                const homeClub = clubMap[norm(homeIdRaw)] || { name: homeIdRaw, logoURL: '' }
                const awayClub = clubMap[norm(awayIdRaw)] || { name: awayIdRaw, logoURL: '' }
                const homeName = capitalize(homeClub.name)
                const awayName = capitalize(awayClub.name)

                const fieldFromId = (id) =>
                  id ? `score${id.charAt(0).toUpperCase()}${id.slice(1)}` : null

                const sHome =
                  typeof f.scoreA === 'number'
                    ? f.scoreA
                    : typeof f[fieldFromId(homeIdRaw)] === 'number'
                      ? f[fieldFromId(homeIdRaw)]
                      : null

                const sAway =
                  typeof f.scoreB === 'number'
                    ? f.scoreB
                    : typeof f[fieldFromId(awayIdRaw)] === 'number'
                      ? f[fieldFromId(awayIdRaw)]
                      : null

                const score =
                  Number.isFinite(sHome) && Number.isFinite(sAway) ? `${sHome}–${sAway}` : null

                return (
                  <li key={f.id} className="rounded-2xl bg-slate-900/60 ring-1 ring-slate-800 p-4 md:p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
                      {/* Date */}
                      <div className="md:w-36">
                        <div className="text-xs uppercase tracking-wide text-slate-400">Date</div>
                        <div className="font-semibold">{String(f.date)}</div>
                      </div>

                      {/* Teams + Ground */}
                      <div className="flex-1">
                        <div className="grid grid-cols-[max-content_auto_max-content] items-center justify-center gap-3 w-full">
                          <Team name={homeName} logoURL={homeClub.logoURL} />
                          <div className="text-slate-400 font-semibold text-center px-2">vs.</div>
                          <Team name={awayName} logoURL={awayClub.logoURL} align="right" />
                        </div>

                        {f.ground && (
                          <div className="mt-2 flex items-center justify-center gap-2 text-sm text-slate-400">
                            <Pin className="text-slate-500" />
                            <span>{f.ground}</span>
                          </div>
                        )}
                      </div>

                      {/* Round + Score */}
                      <div className="md:w-24 text-right">
                        <div className="text-xs uppercase tracking-wide text-slate-400">Round</div>
                        <div className="font-semibold">{f.roundNumber ?? '-'}</div>
                        {score && <div className="mt-1 text-lg font-extrabold">{score}</div>}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
