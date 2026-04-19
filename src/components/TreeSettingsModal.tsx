'use client'
import { useState } from 'react'
import { updateTree, Tree } from '@/lib/db'
import toast from 'react-hot-toast'
import styles from './Modal.module.css'

const CATEGORIES = ['Family','Greek Mythology','Roman Mythology','Egyptian Mythology',
  'Norse Mythology','Hindu Mythology','Fictional Universe','Historical','Other']

interface Props {
  tree: Tree
  isOwner: boolean
  onClose: () => void
  onUpdated: (tree: Tree) => void
}

export default function TreeSettingsModal({ tree, isOwner, onClose, onUpdated }: Props) {
  const [title, setTitle]       = useState(tree.title)
  const [category, setCategory] = useState(tree.category || 'Family')
  const [showType, setShowType] = useState(tree.showType !== false)
  const [coAdmins]              = useState<string[]>(tree.coAdmins || [])
  const [newCoAdmin, setNewCoAdmin] = useState('')
  const [coAdminList, setCoAdminList] = useState<string[]>(tree.coAdmins || [])
  const [customFields, setCustomFields] = useState<string[]>(tree.customFieldDefs || [])
  const [newField, setNewField] = useState('')
  const [saving, setSaving]     = useState(false)

  const addCoAdmin = () => {
    const v = newCoAdmin.trim().toLowerCase()
    if (!v || !v.includes('@')) { toast.error('Enter a valid email'); return }
    if (coAdminList.includes(v)) { toast.error('Already a co-admin'); return }
    setCoAdminList([...coAdminList, v])
    setNewCoAdmin('')
  }

  const addField = () => {
    const v = newField.trim()
    if (!v) return
    if (customFields.includes(v)) { toast.error('Field already exists'); return }
    setCustomFields([...customFields, v])
    setNewField('')
  }

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const updates: Partial<Tree> = {
        title: title.trim(),
        category,
        showType,
        coAdmins: coAdminList,
        customFieldDefs: customFields,
      }
      await updateTree(tree.id, updates)
      toast.success('Settings saved')
      onUpdated({ ...tree, ...updates })
      onClose()
    } catch { toast.error('Failed to save'); setSaving(false) }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.scroll}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>Tree Settings</h2>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          {/* Tree name */}
          <div className={styles.group}>
            <label className={styles.label}>Tree name</label>
            <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Tree name" />
          </div>

          {/* Category */}
          <div className={styles.group}>
            <label className={styles.label}>Category</label>
            <select className={styles.input} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Visibility */}
          <div className={styles.group}>
            <label className={styles.label}>Display options</label>
            <label className={styles.toggleRow}>
              <input type="checkbox" checked={showType} onChange={e => setShowType(e.target.checked)} />
              <span>Show type/role label on person nodes</span>
            </label>
          </div>

          {/* Co-admins */}
          {isOwner && (
            <div className={styles.group}>
              <label className={styles.label}>Co-admins</label>
              <p style={{ fontSize:12, color:'var(--c-text-3)', marginBottom:8, lineHeight:1.4 }}>
                Can add and edit, but cannot delete or manage settings.
              </p>
              {coAdminList.map(ca => (
                <div key={ca} className={styles.cfRow}>
                  <span className={styles.cfName}>{ca}</span>
                  <button className={styles.cfDel} onClick={() => setCoAdminList(coAdminList.filter(x => x !== ca))}>Remove</button>
                </div>
              ))}
              <div className={styles.addRow} style={{ marginTop:8 }}>
                <input className={styles.input} style={{ flex:1 }} type="email" inputMode="email"
                  placeholder="Email address..." value={newCoAdmin}
                  onChange={e => setNewCoAdmin(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCoAdmin() }} />
                <button className={styles.addBtn} onClick={addCoAdmin}>Add</button>
              </div>
            </div>
          )}

          {/* Custom fields */}
          <div className={styles.group}>
            <label className={styles.label}>Custom fields</label>
            <p style={{ fontSize:12, color:'var(--c-text-3)', marginBottom:8, lineHeight:1.4 }}>
              Extra fields shown for every person in this tree.
            </p>
            {customFields.length === 0
              ? <p style={{ fontSize:13, color:'var(--c-text-3)', marginBottom:8 }}>No custom fields yet.</p>
              : customFields.map(f => (
                <div key={f} className={styles.cfRow}>
                  <span className={styles.cfName}>{f}</span>
                  <button className={styles.cfDel} onClick={() => {
                    if (confirm(`Remove field "${f}"?`)) setCustomFields(customFields.filter(x => x !== f))
                  }}>Remove</button>
                </div>
              ))
            }
            <div className={styles.addRow} style={{ marginTop:8 }}>
              <input className={styles.input} style={{ flex:1 }} placeholder="Field name..."
                value={newField} onChange={e => setNewField(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addField() }} />
              <button className={styles.addBtn} onClick={addField}>Add</button>
            </div>
          </div>

          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
