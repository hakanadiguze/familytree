'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { deleteTree } from '@/lib/db'
import toast from 'react-hot-toast'
import styles from './superadmin.module.css'

const SUPER_ADMIN_EMAIL = 'hakanadiguzel@gmail.com'

interface TreeInfo {
  id: string
  title: string
  category?: string
  ownerId: string
  ownerName?: string
  ownerEmail?: string
  coAdmins: string[]
  peopleCount?: number
  createdAt: { seconds: number } | null
  shareSlug: string
}

export default function SuperAdmin() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [trees, setTrees] = useState<TreeInfo[]>([])
  const [fetching, setFetching] = useState(true)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL

  useEffect(() => {
    if (!loading && (!user || !isSuperAdmin)) {
      router.push('/')
    }
  }, [user, loading, isSuperAdmin, router])

  useEffect(() => {
    if (!isSuperAdmin) return
    fetchAll()
  }, [isSuperAdmin])

  const fetchAll = async () => {
    setFetching(true)
    try {
      const snap = await getDocs(collection(db, 'trees'))
      const result: TreeInfo[] = []
      for (const d of snap.docs) {
        const data = d.data()
        // Count people
        const pSnap = await getDocs(collection(db, 'trees', d.id, 'people'))
        result.push({
          id: d.id,
          title: data.title || 'Untitled',
          category: data.category,
          ownerId: data.ownerId,
          ownerName: data.ownerName,
          coAdmins: data.coAdmins || [],
          peopleCount: pSnap.size,
          createdAt: data.createdAt || null,
          shareSlug: data.shareSlug,
        })
      }
      result.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      setTrees(result)
    } catch (e) {
      toast.error('Failed to load data')
    }
    setFetching(false)
  }

  const handleDelete = async (tree: TreeInfo) => {
    if (!confirm(`Permanently delete "${tree.title}" and all its data?`)) return
    setDeleting(tree.id)
    try {
      await deleteTree(tree.id)
      setTrees(t => t.filter(x => x.id !== tree.id))
      toast.success('Tree deleted')
    } catch {
      toast.error('Delete failed')
    }
    setDeleting(null)
  }

  const filtered = trees.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.ownerName || '').toLowerCase().includes(search.toLowerCase()) ||
    t.coAdmins.some(c => c.toLowerCase().includes(search.toLowerCase()))
  )

  // Stats
  const totalPeople = trees.reduce((s, t) => s + (t.peopleCount || 0), 0)
  const uniqueOwners = new Set(trees.map(t => t.ownerId)).size

  if (loading) return <div className={styles.center}><div className={styles.spinner} /></div>
  if (!isSuperAdmin) return null

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>🌳</span>
          <div>
            <div className={styles.logoText}>Super Admin</div>
            <div className={styles.logoBadge}>👑 {user?.email}</div>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.btnGhost} onClick={() => router.push('/dashboard')}>My Trees</button>
          <button className={styles.btnGhost} onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className={styles.main}>
        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statValue}>{trees.length}</div>
            <div className={styles.statLabel}>Total trees</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{uniqueOwners}</div>
            <div className={styles.statLabel}>Unique owners</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{totalPeople}</div>
            <div className={styles.statLabel}>Total people</div>
          </div>
        </div>

        {/* Search */}
        <div className={styles.searchWrap}>
          <input
            className={styles.searchInput}
            placeholder="Search by title, owner, co-admin..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className={styles.refreshBtn} onClick={fetchAll}>↻ Refresh</button>
        </div>

        {/* Tree list */}
        {fetching ? (
          <div className={styles.center}><div className={styles.spinner} /></div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No trees found</div>
        ) : (
          <div className={styles.list}>
            {filtered.map(tree => (
              <div key={tree.id} className={styles.card}>
                <div className={styles.cardMain}>
                  <div className={styles.cardHeader}>
                    <div>
                      <div className={styles.cardTitle}>{tree.title}</div>
                      <div className={styles.cardCat}>{tree.category || 'Family'}</div>
                    </div>
                    <div className={styles.cardBadge}>{tree.peopleCount} people</div>
                  </div>
                  <div className={styles.cardMeta}>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Owner</span>
                      <span className={styles.metaVal}>{tree.ownerName || tree.ownerId}</span>
                    </div>
                    {tree.coAdmins.length > 0 && (
                      <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Co-admins</span>
                        <span className={styles.metaVal}>{tree.coAdmins.join(', ')}</span>
                      </div>
                    )}
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Created</span>
                      <span className={styles.metaVal}>
                        {tree.createdAt
                          ? new Date(tree.createdAt.seconds * 1000).toLocaleDateString()
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button
                    className={styles.btnView}
                    onClick={() => window.open(`/tree/${tree.shareSlug}`, '_blank')}
                  >
                    View ↗
                  </button>
                  <button
                    className={styles.btnDelete}
                    onClick={() => handleDelete(tree)}
                    disabled={deleting === tree.id}
                  >
                    {deleting === tree.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className={styles.footer}>Developed for Yami</footer>
    </div>
  )
}
