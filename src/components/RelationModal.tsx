'use client'
import { useState } from 'react'
import { Person, Relation } from '@/lib/db'
import styles from './Modal.module.css'

// Minimal, GEDCOM-compatible relation types
// Parent → FAM CHIL (parent is HUSB or WIFE, this person is CHIL)
// Spouse → FAM HUSB+WIFE
// Partner → same as Spouse but unmarried
// Sibling → same FAM CHIL (useful when parents unknown)
// Custom → NOTE in GED
const PRESET_TYPES = ['Parent', 'Spouse', 'Partner', 'Sibling']

interface Props {
  people: Person[]
  onSave: (data: Omit<Relation, 'id'>) => Promise<void>
  onClose: () => void
  defaultFrom?: string
  defaultTo?: string
}

export default function RelationModal({ people, onSave, onClose, defaultFrom, defaultTo }: Props) {
  const [from, setFrom]     = useState(defaultFrom || people[0]?.id || '')
  const [to, setTo]         = useState(defaultTo   || people[1]?.id || people[0]?.id || '')
  const [type, setType]     = useState('Parent')
  const [customType, setCustomType] = useState('')
  const [isCustom, setIsCustom]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const finalType = isCustom ? customType.trim() : type

  const handleSave = async () => {
    if (from === to) { setErr('Cannot relate a person to themselves.'); return }
    if (!finalType)  { setErr('Please select or enter a relationship type.'); return }
    setSaving(true)
    try { await onSave({ from, to, type: finalType }) }
    catch { setErr('Failed to save.'); setSaving(false) }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.scroll}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>Add connection</h2>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          <div className={styles.group}>
            <label className={styles.label}>From</label>
            <select className={styles.input} value={from} onChange={e => setFrom(e.target.value)}>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className={styles.group}>
            <label className={styles.label}>Connection type</label>
            <div className={styles.typeGrid}>
              {PRESET_TYPES.map(t => (
                <button key={t}
                  className={`${styles.typeBtn} ${!isCustom && type === t ? styles.typeBtnActive : ''}`}
                  onClick={() => { setIsCustom(false); setType(t) }}>
                  {t}
                </button>
              ))}
              <button
                className={`${styles.typeBtn} ${styles.typeBtnCustom} ${isCustom ? styles.typeBtnActive : ''}`}
                onClick={() => setIsCustom(true)}>
                ✏️ Custom...
              </button>
            </div>

            {isCustom && (
              <input className={styles.input} style={{ marginTop: 10 }}
                placeholder="e.g. Mentor, Creator, Twin..."
                value={customType} onChange={e => setCustomType(e.target.value)} autoFocus />
            )}

            {!isCustom && (
              <div className={styles.selectedType}>
                Selected: <strong>{type}</strong>
                {type === 'Parent' && <span className={styles.typeHint}> — From is the parent of To</span>}
                {type === 'Spouse' && <span className={styles.typeHint}> — Married couple</span>}
                {type === 'Partner' && <span className={styles.typeHint}> — Unmarried couple</span>}
                {type === 'Sibling' && <span className={styles.typeHint}> — Brothers/sisters</span>}
              </div>
            )}
          </div>

          <div className={styles.group}>
            <label className={styles.label}>To</label>
            <select className={styles.input} value={to} onChange={e => setTo(e.target.value)}>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {err && <div className={styles.err}>{err}</div>}

          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving || !finalType}>
            {saving ? 'Adding...' : 'Add connection'}
          </button>
        </div>
      </div>
    </div>
  )
}
