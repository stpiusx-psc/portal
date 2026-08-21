import { useEffect, useMemo, useState } from 'react'
import { useStore } from './lib/store'
import { Dashboard } from './views/Dashboard'
import { CalendarView } from './views/CalendarView'
import { EventsView } from './views/EventsView'
import { ReportsView } from './views/ReportsView'
import { PecMeetingView } from './views/PecMeetingView'
import { TeamView } from './views/TeamView'
import { DataView } from './views/DataView'

export type Route =
  | { view: 'dashboard' }
  | { view: 'calendar' }
  | { view: 'events'; id?: string }
  | { view: 'reports' }
  | { view: 'pec-meeting' }
  | { view: 'team' }
  | { view: 'data' }

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [view, id] = h.split('/')
  switch (view) {
    case 'calendar': return { view: 'calendar' }
    case 'events': return { view: 'events', id: id || undefined }
    case 'reports': return { view: 'reports' }
    case 'pec-meeting': return { view: 'pec-meeting' }
    case 'team': return { view: 'team' }
    case 'data': return { view: 'data' }
    default: return { view: 'dashboard' }
  }
}

export function navigate(route: Route) {
  const parts: string[] = [route.view]
  if (route.view === 'events' && route.id) parts.push(route.id)
  window.location.hash = `#/${parts.join('/')}`
}

const NAV: { view: Route['view']; label: string; icon: string; group: string }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: '◈', group: 'Overview' },
  { view: 'calendar', label: 'Year Calendar', icon: '▦', group: 'Overview' },
  { view: 'events', label: 'Events & Playbooks', icon: '❑', group: 'Overview' },
  { view: 'reports', label: 'PEC Reports', icon: '✎', group: 'PEC liaison' },
  { view: 'pec-meeting', label: 'PEC Meeting Notes', icon: '✉', group: 'PEC liaison' },
  { view: 'team', label: 'Team & Roles', icon: '☰', group: 'Reference' },
  { view: 'data', label: 'Backup & Data', icon: '⇅', group: 'Reference' },
]

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash())
  const store = useStore()

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const groups = useMemo(() => {
    const out: { group: string; items: typeof NAV }[] = []
    for (const item of NAV) {
      const last = out[out.length - 1]
      if (last && last.group === item.group) last.items.push(item)
      else out.push({ group: item.group, items: [item] })
    }
    return out
  }, [])

  const openEvents = store.events.filter((e) => e.status === 'active').length

  return (
    <div className="shell">
      <aside className="sidebar no-print">
        <div className="brand">
          <div className="brand-crest" aria-hidden>SPX</div>
          <div className="brand-name">St. Pius X PSC</div>
          <div className="brand-sub">Parent Standing Committee · {store.schoolYear}</div>
        </div>
        <nav className="nav">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="nav-section">{g.group}</div>
              {g.items.map((item) => (
                <button
                  key={item.view}
                  className="nav-item"
                  aria-current={route.view === item.view ? 'page' : undefined}
                  onClick={() => navigate({ view: item.view } as Route)}
                >
                  <span className="ico" aria-hidden>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.view === 'events' && <span className="nav-badge">{openEvents}</span>}
                  {item.view === 'reports' && store.reports.length > 0 && <span className="nav-badge">{store.reports.length}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          Reverence · Respect · Responsibility
        </div>
      </aside>

      <main className="main">
        {route.view === 'dashboard' && <Dashboard store={store} />}
        {route.view === 'calendar' && <CalendarView store={store} />}
        {route.view === 'events' && <EventsView store={store} selectedId={route.id} />}
        {route.view === 'reports' && <ReportsView store={store} />}
        {route.view === 'pec-meeting' && <PecMeetingView store={store} />}
        {route.view === 'team' && <TeamView store={store} />}
        {route.view === 'data' && <DataView store={store} />}
      </main>
    </div>
  )
}
