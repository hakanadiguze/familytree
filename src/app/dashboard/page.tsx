'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { getUserTrees, getCoAdminTrees, createTree, deleteTree, Tree } from '@/lib/db'
import toast from 'react-hot-toast'
import styles from './dashboard.module.css'
import TreeSettingsModal from '@/components/TreeSettingsModal'
import Image from 'next/image'

const CATEGORIES = ['Family', 'Greek Mythology', 'Roman Mythology', 'Egyptian Mythology',
  'Norse Mythology', 'Hindu Mythology', 'Fictional Universe', 'Historical', 'Other']

export default function Dashboard() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [trees, setTrees] = useState<Tree[]>([])
  const [coTrees, setCoTrees] = useState<Tree[]>([])
  const [fetching, setFetching] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [settingsTree, setSettingsTree] = useState<Tree | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'Family' })

  useEffect(() => {
    if (!loading && !user) router.push('/')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    Promise.all([
      getUserTrees(user.uid),
      getCoAdminTrees(user.email || '')
    ]).then(([myTrees, coAdminTrees]) => {
      const sorted = (t: Tree[]) => t.sort((a, b) => {
        const at = (a.createdAt as { seconds: number })?.seconds ?? 0
        const bt = (b.createdAt as { seconds: number })?.seconds ?? 0
        return bt - at
      })
      setTrees(sorted(myTrees))
      // exclude trees already owned by user
      setCoTrees(sorted(coAdminTrees.filter(t => t.ownerId !== user.uid)))
      setFetching(false)
    }).catch(() => setFetching(false))
  }, [user])

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setCreating(true)
    try {
      const id = await createTree(user!.uid, user!.displayName || 'Unknown', form)
      toast.success('Tree created!')
      router.push(`/dashboard/${id}`)
    } catch {
      toast.error('Failed to create tree')
      setCreating(false)
    }
  }

  const handleDelete = async (tree: Tree) => {
    if (!confirm(`Delete "${tree.title}"? This cannot be undone.`)) return
    await deleteTree(tree.id)
    setTrees(t => t.filter(x => x.id !== tree.id))
    toast.success('Tree deleted')
  }

  const shareUrl = (slug: string) =>
    `${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : ''  )}/tree/${slug}`

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(shareUrl(slug))
    toast.success('Link copied!')
  }

  if (loading || !user) return <div className={styles.center}><div className={styles.spinner} /></div>

  const TreeCard = ({ tree, isOwner }: { tree: Tree; isOwner: boolean }) => (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.cardCat}>
          {tree.category || 'Family'}
          {!isOwner && <span className={styles.coAdminBadge}>Co-admin</span>}
        </div>
        <h2 className={styles.cardTitle}>{tree.title}</h2>
        {tree.description && <p className={styles.cardDesc}>{tree.description}</p>}
      </div>
      <div className={styles.cardActions}>
        <button className={styles.btnPrimary} onClick={() => router.push(`/dashboard/${tree.id}`)}>
          Edit
        </button>
        <button className={styles.btnIcon} onClick={() => copyLink(tree.shareSlug)} title="Copy share link">🔗</button>
        <button className={styles.btnIcon} onClick={() => router.push(`/tree/${tree.shareSlug}`)} title="Preview">👁</button>
        <button className={styles.btnIcon} onClick={() => setSettingsTree(tree)} title="Settings">⚙️</button>
        {isOwner && (
          <button className={styles.btnIconDanger} onClick={() => handleDelete(tree)} title="Delete">🗑️</button>
        )}
      </div>
    </div>
  )

  return (
    <div className={styles.page}>

      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>🌳</span>
          <span className={styles.logoText}>Family Tree</span>
        </div>
        <div className={styles.headerRight}>
          {user.photoURL && (
            <Image src={user.photoURL} alt="Avatar" width={32} height={32} className={styles.avatar} />
          )}
          {user.email === 'hakanadiguzel@gmail.com' && (
            <button className={styles.btnGhost} onClick={() => router.push('/superadmin')} style={{color:'#534AB7',fontWeight:500}}>
              👑 Super Admin
            </button>
          )}
          <button className={styles.btnGhost} onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className={styles.main}>
        {/* My Trees */}
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>My Trees</h1>
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ New tree</button>
        </div>

        {fetching ? (
          <div className={styles.center}><div className={styles.spinner} /></div>
        ) : trees.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🌱</div>
            <p>No trees yet. Create your first one!</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {trees.map(tree => <TreeCard key={tree.id} tree={tree} isOwner={true} />)}
          </div>
        )}

        {/* Co-admin Trees */}
        {coTrees.length > 0 && (
          <>
            <div className={styles.titleRow} style={{ marginTop: 28 }}>
              <h2 className={styles.pageTitle} style={{ fontSize: 18 }}>Shared with me</h2>
            </div>
            <div className={styles.grid}>
              {coTrees.map(tree => <TreeCard key={tree.id} tree={tree} isOwner={false} />)}
            </div>
          </>
        )}
      </main>

      {/* Create modal */}
      {showCreate && (
        <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Create new tree</h2>
            <div className={styles.formGroup}>
              <label className={styles.label}>Title <span style={{ color: '#A32D2D' }}>*</span></label>
              <input className={styles.input} placeholder="e.g. Greek Gods, Johnson Family..."
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Category</label>
              <select className={styles.input} value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Description</label>
              <textarea className={styles.input} rows={3} placeholder="Optional..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className={styles.btnRow}>
              <button className={styles.btnSecondary} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsTree && (
        <TreeSettingsModal
          tree={settingsTree}
          isOwner={settingsTree.ownerId === user.uid}
          onClose={() => setSettingsTree(null)}
          onUpdated={updated => {
            setTrees(t => t.map(x => x.id === updated.id ? updated : x))
            setSettingsTree(null)
          }}
        />
      )}

      <footer className={styles.footer}>Developed for Yami</footer>
    </div>
  )
}
