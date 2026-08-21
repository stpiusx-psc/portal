import { useEffect, useMemo, useState } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { REMOTE_ENABLED } from './lib/supabase'
import { useStore } from './lib/store'
import { Dashboard } from './views/Dashboard'
import { CalendarView } from './views/CalendarView'
import { EventsView } from './views/EventsView'
import { ReportsView } from './views/ReportsView'
import { PecMeetingView } from './views/PecMeetingView'
import { TeamView } from './views/TeamView'
import { DataView } from './views/DataView'
import { MembersView } from './views/MembersView'
import { NoAccess, SetNewPassword, SignIn } from './views/SignIn'

export type Route =
  | { view: 'dashboard' }
  | { view: 'calendar' }
  | { view: 'events'; id?: string }
  | { view: 'reports' }
  | { view: 'pec-meeting' }
  | { view: 'team' }
  | { view: 'data' }
  | { view: 'members' }

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
    case 'members': return { view: 'members' }
    default: return { view: 'dashboard' }
  }
}

export function navigate(route: Route) {
  const parts: string[] = [route.view]
  if (route.view === 'events' && route.id) parts.push(route.id)
  window.location.hash = `#/${parts.join('/')}`
}

const NAV: { view: Route['view']; label: string; icon: string; group: string; adminOnly?: boolean }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: '◈', group: 'Overview' },
  { view: 'calendar', label: 'Year Calendar', icon: '▦', group: 'Overview' },
  { view: 'events', label: 'Events & Playbooks', icon: '❑', group: 'Overview' },
  { view: 'reports', label: 'PEC Reports', icon: '✎', group: 'PEC liaison' },
  { view: 'pec-meeting', label: 'PEC Meeting Notes', icon: '✉', group: 'PEC liaison' },
  { view: 'team', label: 'Team & Roles', icon: '☰', group: 'Reference' },
  { view: 'data', label: 'Backup & Data', icon: '⇅', group: 'Reference' },
  { view: 'members', label: 'People & Access', icon: '⚿', group: 'Reference', adminOnly: true },
]

export function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

/** Decides whether to show the front door, the "not invited" notice, or the app. */
function Gate() {
  const auth = useAuth()

  if (REMOTE_ENABLED) {
    if (auth.loading) {
      return (
        <div className="auth-page">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <div className="brand-crest" aria-hidden style={{ margin: '0 auto 14px' }}>SPX</div>
            <p style={{ margin: 0, color: 'var(--ink-muted)' }}>Loading the portal…</p>
          </div>
        </div>
      )
    }
    if (!auth.session) return <SignIn />
    // A recovery session must set a new password before anything else.
    if (auth.recovery) return <SetNewPassword />
    if (!auth.member) return <NoAccess />
  }

  return <Shell />
}

function Shell() {
  const auth = useAuth()
  const [route, setRoute] = useState<Route>(() => parseHash())
  const store = useStore({
    remote: Boolean(auth.member),
    // With no server there is nobody to authenticate, so local use is editable.
    canEdit: REMOTE_ENABLED ? auth.canEdit : true,
    email: auth.email,
  })

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const groups = useMemo(() => {
    const visible = NAV.filter((i) => !i.adminOnly || auth.isAdmin)
    const out: { group: string; items: typeof NAV }[] = []
    for (const item of visible) {
      const last = out[out.length - 1]
      if (last && last.group === item.group) last.items.push(item)
      else out.push({ group: item.group, items: [item] })
    }
    return out
  }, [auth.isAdmin])

  const openEvents = store.events.filter((e) => e.status === 'active').length

  return (
    <div className="shell">
      <aside className="sidebar no-print">
        <div className="brand">
          <div className="brand-crest" aria-hidden>SPX</div>
          <div className="brand-name">St. Pius X PSC</div>
          <div className="brand-sub">Parent Standing Committee · {store.schoolYear}</div>
          {REMOTE_ENABLED && (
            <div style={{ marginTop: 9 }}>
              <span className={`sync-pill${store.sync === 'error' ? ' err' : ''}`}>
                {store.sync === 'loading' ? 'Loading…'
                  : store.sync === 'error' ? 'Sync problem'
                  : store.readOnly ? 'Shared · read only' : 'Shared · saving live'}
              </span>
            </div>
          )}
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

        {REMOTE_ENABLED && auth.email && (
          <div className="sidebar-user">
            <div className="who">{auth.member?.display_name || auth.email}</div>
            <div>{auth.role === 'admin' ? 'Administrator' : auth.role === 'editor' ? 'Editor' : 'Viewer'}</div>
            <button className="btn btn-sm" onClick={() => void auth.signOut()}>Sign out</button>
          </div>
        )}

        <div className="sidebar-foot">Reverence · Respect · Responsibility</div>
      </aside>

      <main className="main">
        {store.sync === 'error' && store.syncMessage && (
          <div className="banner banner-warn no-print" style={{ margin: '14px 28px 0', borderRadius: 6 }}>
            {store.syncMessage}
          </div>
        )}
        {store.readOnly && REMOTE_ENABLED && (
          <div className="banner banner-info no-print" style={{ margin: '14px 28px 0', borderRadius: 6 }}>
            You have <strong>read-only</strong> access, so nothing you change here will be saved.
            Ask Jorge for editor access if you need to update the calendar.
          </div>
        )}

        {route.view === 'dashboard' && <Dashboard store={store} />}
        {route.view === 'calendar' && <CalendarView store={store} />}
        {route.view === 'events' && <EventsView store={store} selectedId={route.id} />}
        {route.view === 'reports' && <ReportsView store={store} />}
        {route.view === 'pec-meeting' && <PecMeetingView store={store} />}
        {route.view === 'team' && <TeamView store={store} />}
        {route.view === 'data' && <DataView store={store} />}
        {route.view === 'members' && <MembersView />}
      </main>
    </div>
  )
}
