'use client'
import { useState } from 'react'
import styles from './Modal.module.css'

interface Props {
  defs: string[]
  onSave: (defs: string[]) => Promise<void>
  onClose: () => void
}

export default function CustomFieldsModal({ defs, onSave, onClose }: Props) {
  const [fields, setFields] = useState<string[]>([...defs])
  const [newField, setNewField] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const add = () => {
    const v = newField.trim()
    if (!v) return
    if (fields.includes(v)) { setErr('Field already exists.'); return }
    setFields(f => [...f, v])
    setNewField('')
    setErr('')
  }

  const remove = (f: string) => {
    if (!confirm(`Remove field "${f}"? Existing values for this field will be lost.`)) return
    setFields(prev => prev.filter(x => x !== f))
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(fields)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.scroll}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>Custom fields</h2>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          <p style={{ fontSize: 13, color: 'var(--c-text-2)', marginBottom: 16, lineHeight: 1.5 }}>
            These fields appear for every person in this tree. Add fields like "Domain", "Dynasty", "Symbol", "Cause of death", etc.
          </p>

          {fields.length === 0 && (
            <div style={{ fontSize: 14, color: 'var(--c-text-3)', marginBottom: 16 }}>No custom fields yet.</div>
          )}

          {fields.map(f => (
            <div key={f} className={styles.cfRow}>
              <span className={styles.cfName}>{f}</span>
              <button className={styles.cfDel} onClick={() => remove(f)}>Remove</button>
            </div>
          ))}

          <div className={styles.addRow}>
            <input
              className={styles.input}
              style={{ flex: 1 }}
              value={newField}
              onChange={e => setNewField(e.target.value)}
              placeholder="New field name..."
              onKeyDown={e => { if (e.key === 'Enter') add() }}
            />
            <button className={styles.addBtn} onClick={add}>Add</button>
          </div>
          {err && <div className={styles.err}>{err}</div>}

          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving} style={{ marginTop: 16 }}>
            {saving ? 'Saving...' : 'Save fields'}
          </button>
        </div>
      </div>
    </div>
  )
}
