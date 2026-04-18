'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import {
  getTreeById, getPeople, getRelations, updateTree,
  addPerson, updatePerson, deletePerson,
  addRelation, deleteRelation,
  Tree, Person, Relation
} from '@/lib/db'
import { exportGED, downloadGED, parseGED } from '@/lib/ged'
import { exportTreeAsPdf } from '@/lib/exportPdf'
import { computeLayout } from '@/lib/layout'
import toast from 'react-hot-toast'
import TreeCanvas from '@/components/TreeCanvas'
import PersonPanel from '@/components/PersonPanel'
import PersonModal from '@/components/PersonModal'
import RelationModal from '@/components/RelationModal'
import CustomFieldsModal from '@/components/CustomFieldsModal'
import CoAdminModal from '@/components/CoAdminModal'
import TreeSettingsModal from '@/components/TreeSettingsModal'

import styles from './editor.module.css'

type ModalType =
  | null
  | { type: 'addPerson'; x?: number; y?: number }
  | { type: 'editPerson'; person: Person }
  | { type: 'addRelation'; fromId?: string; toId?: string }
  | { type: 'customFields' }
  | { type: 'coAdmin' }
  | { type: 'settings' }

export default function TreeEditor() {
  const { id } = useParams<{ id: string }>()
  const { user, loading } = useAuth()
  const router = useRouter()

  const [tree, setTree] = useState<Tree | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [relations, setRelations] = useState<Relation[]>([])
  const [fetching, setFetching] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const isSuperAdmin = user?.email === 'hakanadiguzel@gmail.com'

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'tree' | 'link'>('tree')
  const [modal, setModal] = useState<ModalType>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    Promise.all([getTreeById(id), getPeople(id), getRelations(id)]).then(([t, p, r]) => {
      if (!t) { router.push('/dashboard'); return }
      const coAdmins: string[] = (t.coAdmins || []) as string[]
      const userEmail = user.email || ''
      const canEdit = t.ownerId === user.uid || coAdmins.includes(userEmail)
      if (!canEdit) { router.push('/dashboard'); return }
      setIsOwner(t.ownerId === user.uid)
      setTree(t); setPeople(p); setRelations(r); setFetching(false)
    })
  }, [id, user, router])

  const reload = useCallback(async () => {
    const [p, r] = await Promise.all([getPeople(id), getRelations(id)])
    setPeople(p); setRelations(r)
  }, [id])

  const openPerson = (pid: string) => { setSelectedId(pid); setPanelOpen(true); setFabOpen(false) }

  const handleAddPerson = async (data: Omit<Person, 'id'>) => {
    await addPerson(id, data); toast.success('Person added')
    setModal(null); await reload()
  }

  const handleUpdatePerson = async (pid: string, data: Partial<Person>) => {
    await updatePerson(id, pid, data); toast.success('Saved')
    setModal(null); await reload()
  }

  const handleDeletePerson = async (pid: string) => {
    if (!isOwner) { toast.error('Only the owner can delete'); return }
    if (!confirm('Delete this person and all their relationships?')) return
    await deletePerson(id, pid)
    const toDelete = relations.filter(r => r.from === pid || r.to === pid)
    await Promise.all(toDelete.map(r => deleteRelation(id, r.id)))
    toast.success('Person deleted')
    setModal(null); setPanelOpen(false); setSelectedId(null); await reload()
  }

  const handleAddRelation = async (data: Omit<Relation, 'id'>) => {
    await addRelation(id, data); toast.success('Connection added')
    setModal(null); await reload()
  }

  const handleDeleteRelation = async (rid: string) => {
    if (!isOwner) { toast.error('Only the owner can delete'); return }
    await deleteRelation(id, rid); toast.success('Connection removed'); await reload()
  }

  const handleUpdateFields = async (defs: string[]) => {
    await updateTree(id, { customFieldDefs: defs })
    setTree(t => t ? { ...t, customFieldDefs: defs } : t)
    toast.success('Fields updated'); setModal(null)
  }

  const handleMoveNode = useCallback(async (pid: string, x: number, y: number) => {
    await updatePerson(id, pid, { x, y })
    setPeople(prev => prev.map(p => p.id === pid ? { ...p, x, y } : p))
  }, [id])

  const handleMoveMulti = useCallback(async (moves: { id: string; x: number; y: number }[]) => {
    await Promise.all(moves.map(m => updatePerson(id, m.id, { x: m.x, y: m.y })))
    setPeople(prev => prev.map(p => {
      const m = moves.find(x => x.id === p.id)
      return m ? { ...p, x: m.x, y: m.y } : p
    }))
  }, [id])

  // Drag-to-connect callback
  const handleConnectRequest = useCallback((fromId: string, toId: string) => {
    setModal({ type: 'addRelation', fromId, toId })
  }, [])

  const handleDoubleClickCanvas = useCallback((x: number, y: number) => {
    setModal({ type: 'addPerson', x, y })
  }, [])

  // GED export
  const handleExportGED = () => {
    if (!tree) return
    const content = exportGED(people, relations, tree.title)
    downloadGED(content, tree.title)
    toast.success('GED file downloaded')
    setMenuOpen(false)
  }

  // PDF export
  const handleExportPdf = async () => {
    const el = canvasWrapRef.current
    if (!el || !tree) { toast.error('Nothing to export'); return }
    setMenuOpen(false)
    toast.loading('Generating PDF...')
    try {
      await exportTreeAsPdf(el, people, tree.title)
      toast.dismiss()
      toast.success('PDF downloaded!')
    } catch {
      toast.dismiss()
      toast.error('PDF export failed')
    }
  }

  // Re-layout: recompute hierarchical positions for all people
  const handleRelayout = async () => {
    if (people.length === 0) { toast.error('No people to layout'); return }
    setMenuOpen(false)
    // Pass manual gen overrides
    const manualGens = new Map<string, number>()
    people.forEach(p => { if (p.manualGen !== undefined) manualGens.set(p.id, p.manualGen) })
    const moves = computeLayout(people, relations, manualGens)
    await Promise.all(moves.map(m => updatePerson(id, m.id, { x: m.x, y: m.y })))
    setPeople(prev => prev.map(p => {
      const m = moves.find(x => x.id === p.id)
      return m ? { ...p, x: m.x, y: m.y } : p
    }))
    toast.success('Layout updated!')
  }

  // GED import
  const handleImportGED = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const text = await file.text()
    try {
      const { people: newPeople, relations: newRels } = parseGED(text)
      toast.loading('Importing...')
      // Add people first, get real IDs
      const realIds: string[] = []
      for (const p of newPeople) {
        const rid = await addPerson(id, p)
        realIds.push(rid)
      }
      // Fix index-based relation references
      for (const r of newRels) {
        const fromIdx = parseInt(r.from.replace('__IDX__', ''))
        const toIdx = parseInt(r.to.replace('__IDX__', ''))
        if (!isNaN(fromIdx) && !isNaN(toIdx) && realIds[fromIdx] && realIds[toIdx]) {
          await addRelation(id, { from: realIds[fromIdx], to: realIds[toIdx], type: r.type })
        }
      }
      toast.dismiss()
      toast.success(`Imported ${newPeople.length} people`)
      await reload()
    } catch {
      toast.dismiss()
      toast.error('Failed to import GED file')
    }
    e.target.value = ''
    setMenuOpen(false)
  }

  const shareUrl = () => {
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    return `${base}/tree/${tree?.shareSlug}`
  }
  const copyLink = () => { navigator.clipboard.writeText(shareUrl()); toast.success('Link copied!') }

  if (loading || fetching || !tree) {
    return <div className={styles.center}><div className={styles.spinner} /></div>
  }

  const selectedPerson = people.find(p => p.id === selectedId) ?? null
  const sortedPeople = [...people].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className={styles.page}>
      <input ref={fileInputRef} type="file" accept=".ged" style={{ display: 'none' }} onChange={handleImportGED} />

      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push('/dashboard')}>← Back</button>
        <div className={styles.headerCenter}>
          <div className={styles.headerTitle}>{tree.title}</div>
          <div className={styles.headerCat}>{tree.category}{!isOwner && ' · Co-admin'}</div>
        </div>
        <div style={{ position: 'relative' }}>
          <button className={styles.menuBtn} onClick={() => setMenuOpen(v => !v)}>•••</button>
          {menuOpen && (
            <>
              <div className={styles.menuOverlay} onClick={() => setMenuOpen(false)} />
              <div className={styles.menuDropdown}>
                <button className={styles.menuItem} onClick={() => { copyLink(); setMenuOpen(false) }}>🔗 Copy share link</button>
                <button className={styles.menuItem} onClick={() => { setModal({ type: 'settings' }); setMenuOpen(false) }}>⚙️ Settings</button>
                <div className={styles.menuDivider} />
                <button className={styles.menuItem} onClick={handleExportGED}>⬇️ Export .ged</button>
                <button className={styles.menuItem} onClick={() => { fileInputRef.current?.click() }}>⬆️ Import .ged</button>
                <button className={styles.menuItem} onClick={handleExportPdf}>🖨️ Export PDF</button>
                <div className={styles.menuDivider} />
                {isSuperAdmin && <button className={styles.menuItem} onClick={handleRelayout}>⬍ Auto re-layout</button>}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <div className={styles.content}>
        {activeTab === 'tree' && (
          <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div ref={canvasWrapRef} style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <TreeCanvas
                people={people}
                relations={relations}
                selectedId={selectedId}
                isAdmin
                onSelect={openPerson}
                onMove={handleMoveNode}
                onMoveMulti={handleMoveMulti}
                onConnectRequest={handleConnectRequest}
                onDoubleClickCanvas={handleDoubleClickCanvas}
              />
            </div>
            {fabOpen && <div className={styles.fabOverlay} onClick={() => setFabOpen(false)} />}
            <div className={styles.fabWrap}>
              {fabOpen && (
                <div className={styles.fabMenu}>
                  <button className={styles.fabMenuItem} onClick={() => { setFabOpen(false); setModal({ type: 'addRelation' }) }}>
                    <span className={styles.fabMenuIcon}>🔗</span><span>Add connection</span>
                  </button>
                  <button className={styles.fabMenuItem} onClick={() => { setFabOpen(false); setModal({ type: 'addPerson' }) }}>
                    <span className={styles.fabMenuIcon}>👤</span><span>Add person</span>
                  </button>
                </div>
              )}
              <button className={`${styles.fab} ${fabOpen ? styles.fabOpen : ''}`} onClick={() => setFabOpen(v => !v)}>
                <span className={styles.fabIcon}>+</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'link' && (
          <div className={styles.linkWrap}>
            <div className={styles.linkCard}>
              <div className={styles.linkIcon}>🔗</div>
              <div className={styles.linkTitle}>Share this tree</div>
              <p className={styles.linkDesc}>Anyone with this link can view the tree in read-only mode. No account needed.</p>
              <div className={styles.linkBox}><span className={styles.linkUrl}>{shareUrl()}</span></div>
              <button className={styles.linkCopyBtn} onClick={copyLink}>Copy link</button>
              <button className={styles.linkOpenBtn} onClick={() => window.open(shareUrl(), '_blank')}>Open preview ↗</button>
            </div>
            <div className={styles.linkCard} style={{ marginTop: 12 }}>
              <div className={styles.linkTitle} style={{ fontSize: 15 }}>Connections ({relations.length})</div>
              {relations.length === 0
                ? <p className={styles.linkDesc}>No connections yet.</p>
                : [...relations].sort((a,b) => {
                      const na = people.find(p=>p.id===a.from)?.name||''
                      const nb = people.find(p=>p.id===b.from)?.name||''
                      return na.localeCompare(nb)
                    }).map(r => {
                    const a = people.find(p => p.id === r.from)
                    const b = people.find(p => p.id === r.to)
                    return (
                      <div key={r.id} className={styles.relRow}>
                        <span className={styles.relText}>{a?.name} → <strong>{r.type}</strong> → {b?.name}</span>
                        {isOwner && <button className={styles.relDel} onClick={() => handleDeleteRelation(r.id)}>×</button>}
                      </div>
                    )
                  })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <nav className={styles.bottomBar}>
        {([['tree', '🌳', 'Tree'], ['link', '🔗', 'Link']] as const).map(([tab, icon, label]) => (
          <button key={tab} className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => { setActiveTab(tab); setFabOpen(false) }}>
            <span>{icon}</span>{label}
          </button>
        ))}
      </nav>

      {/* Person panel */}
      {panelOpen && selectedPerson && (
        <PersonPanel
          person={selectedPerson} tree={tree} people={people} relations={relations}
          isAdmin onClose={() => { setPanelOpen(false); setSelectedId(null) }}
          onEdit={() => setModal({ type: 'editPerson', person: selectedPerson })}
          onNavigate={pid => setSelectedId(pid)}
          onDeleteRelation={async (rid) => { await handleDeleteRelation(rid); await reload() }}
        />
      )}

      {/* Modals */}
      {modal?.type === 'addPerson' && (
        <PersonModal tree={tree} onSave={handleAddPerson} onClose={() => setModal(null)} people={people}
          initialX={modal.x} initialY={modal.y} />
      )}
      {modal?.type === 'editPerson' && (
        <PersonModal tree={tree} person={modal.person}
          onSave={d => handleUpdatePerson(modal.person.id, d)}
          onDelete={isOwner ? () => handleDeletePerson(modal.person.id) : undefined}
          onClose={() => setModal(null)} people={people} />
      )}
      {modal?.type === 'addRelation' && (
        <RelationModal people={sortedPeople} onSave={handleAddRelation} onClose={() => setModal(null)}
          defaultFrom={modal.fromId} defaultTo={modal.toId} />
      )}
      {modal?.type === 'customFields' && (
        <CustomFieldsModal defs={tree.customFieldDefs} onSave={handleUpdateFields} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'coAdmin' && (
        <CoAdminModal tree={tree}
          onClose={() => setModal(null)}
          onUpdated={ca => setTree(t => t ? { ...t, coAdmins: ca } : t)} />
      )}
      {modal?.type === 'settings' && tree && (
        <TreeSettingsModal
          tree={tree}
          isOwner={isOwner}
          onClose={() => setModal(null)}
          onUpdated={updated => setTree(updated)}
        />
      )}

      <div className={styles.footer}>Developed for Yami</div>
    </div>
  )
}
