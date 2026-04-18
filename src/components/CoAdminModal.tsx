'use client'
import { useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { updateTree, Tree } from '@/lib/db'
import toast from 'react-hot-toast'
import styles from './Modal.module.css'

interface Props {
  tree: Tree
  onClose: () => void
  onUpdated: (coAdmins: string[]) => void
}

export default function CoAdminModal({ tree, onClose, onUpdated }: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const coAdmins: string[] = tree.coAdmins || []

  // We store UIDs; for display we store a map uid→email in the tree doc
  // Simpler: store emails directly and resolve on access check
  // → we'll store UIDs looked up from email via users collection
  // For simplicity: store email strings directly (Firebase Auth doesn't expose lookup by email on client)
  // So coAdmins will be an array of emails, and we check auth.currentUser.email

  const add = async () => {
    const v = email.trim().toLowerCase()
    if (!v || !v.includes('@')) { setErr('Enter a valid email address'); return }
    if (coAdmins.includes(v)) { setErr('Already a co-admin'); return }
    setLoading(true)
    try {
      const updated = [...coAdmins, v]
      await updateTree(tree.id, { coAdmins: updated as unknown as string[] })
      onUpdated(updated)
      setEmail('')
      setErr('')
      toast.success('Co-admin added')
    } catch {
      setErr('Failed to add co-admin')
    }
    setLoading(false)
  }

  const remove = async (ca: string) => {
    const updated = coAdmins.filter(x => x !== ca)
    await updateTree(tree.id, { coAdmins: updated as unknown as string[] })
    onUpdated(updated)
    toast.success('Co-admin removed')
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.scroll}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>Co-admins</h2>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.5, marginBottom: 16 }}>
            Co-admins can add and edit people and connections, but cannot delete them or manage co-admins.
          </p>

          {coAdmins.length === 0 && (
            <p style={{ fontSize: 14, color: 'var(--c-text-3)', marginBottom: 12 }}>No co-admins yet.</p>
          )}
          {coAdmins.map(ca => (
            <div key={ca} className={styles.cfRow}>
              <span className={styles.cfName}>{ca}</span>
              <button className={styles.cfDel} onClick={() => remove(ca)}>Remove</button>
            </div>
          ))}

          <div className={styles.addRow} style={{ marginTop: 16 }}>
            <input
              className={styles.input}
              style={{ flex: 1 }}
              type="email"
              inputMode="email"
              placeholder="Email address..."
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add() }}
            />
            <button className={styles.addBtn} onClick={add} disabled={loading}>Add</button>
          </div>
          {err && <div className={styles.err}>{err}</div>}
        </div>
      </div>
    </div>
  )
}
