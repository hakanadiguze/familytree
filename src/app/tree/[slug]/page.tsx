'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getTreeBySlug, getPeople, getRelations, Tree, Person, Relation } from '@/lib/db'
import TreeCanvas from '@/components/TreeCanvas'
import PersonPanel from '@/components/PersonPanel'
import styles from './public.module.css'

export default function PublicTree() {
  const { slug } = useParams<{ slug: string }>()
  const [tree, setTree] = useState<Tree | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [relations, setRelations] = useState<Relation[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'tree' | 'list'>('tree')
  const [search, setSearch] = useState('')

  useEffect(() => {
    getTreeBySlug(slug).then(async t => {
      if (!t) { setNotFound(true); setLoading(false); return }
      const [p, r] = await Promise.all([getPeople(t.id), getRelations(t.id)])
      setTree(t); setPeople(p); setRelations(r); setLoading(false)
    })
  }, [slug])

  if (loading) return <div className={styles.center}><div className={styles.spinner} /></div>
  if (notFound) return (
    <div className={styles.center}>
      <div className={styles.notFound}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
        <h1>Tree not found</h1>
        <p>This link may be invalid or the tree has been removed.</p>
      </div>
    </div>
  )

  const selectedPerson = people.find(p => p.id === selectedId) ?? null
  const filtered = people
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.headerTitle}>{tree!.title}</div>
          <div className={styles.headerMeta}>
            {tree!.category} · {people.length} {people.length === 1 ? 'person' : 'people'}
          </div>
        </div>
        <div className={styles.badge}>Read only</div>
      </header>

      <div className={styles.content}>
        {activeTab === 'tree' && (
          <TreeCanvas
            people={people}
            relations={relations}
            selectedId={selectedId}
            isAdmin={false}
            onSelect={pid => { setSelectedId(pid); setPanelOpen(true) }}
          />
        )}
        {activeTab === 'list' && (
          <div className={styles.listWrap}>
            <div className={styles.listSearch}>
              <input className={styles.searchInput} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {filtered.length === 0 ? (
              <div className={styles.empty}>No results</div>
            ) : filtered.map(p => (
              <div key={p.id} className={styles.listItem} onClick={() => { setActiveTab('tree'); setSelectedId(p.id); setPanelOpen(true) }}>
                <div className={styles.listAvatar} style={{ background: getColor(p.id, people) + '20', color: getColor(p.id, people) }}>
                  {p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : getInitials(p.name)}
                </div>
                <div>
                  <div className={styles.listName}>{p.name}</div>
                  <div className={styles.listSub}>{[p.type, p.birthPlace].filter(Boolean).join(' · ') || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <nav className={styles.bottomBar}>
        {([['tree', '🌳', 'Tree'], ['list', '📋', 'List']] as const).map(([tab, icon, label]) => (
          <button key={tab} className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`} onClick={() => setActiveTab(tab)}>
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      {panelOpen && selectedPerson && (
        <PersonPanel
          person={selectedPerson}
          tree={tree!}
          people={people}
          relations={relations}
          isAdmin={false}
          onClose={() => { setPanelOpen(false); setSelectedId(null) }}
          onNavigate={pid => setSelectedId(pid)}
        />
      )}

      <footer className={styles.footer}>
        <span>🌳 Family Tree</span>
        <span>Developed for Yami</span>
      </footer>
    </div>
  )
}

const COLORS = ['#534AB7','#0F6E56','#993C1D','#993556','#185FA5','#3B6D11','#854F0B','#A32D2D']
function getColor(id: string, people: Person[]) {
  const i = people.findIndex(p => p.id === id)
  return COLORS[(i < 0 ? 0 : i) % COLORS.length]
}
function getInitials(name: string) {
  return name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?'
}
