'use client'
import { useState, useRef } from 'react'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { parseToInputDate } from '@/lib/dateUtils'
import { Person, Tree } from '@/lib/db'
import styles from './Modal.module.css'

const CLOUD_NAME    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME    || ''
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || ''

interface Props {
  tree: Tree
  person?: Person
  people: Person[]
  onSave: (data: Omit<Person, 'id'>) => Promise<void>
  onDelete?: () => void
  onClose: () => void
  initialX?: number
  initialY?: number
}

export default function PersonModal({ tree, person, onSave, onDelete, onClose, initialX, initialY }: Props) {
  const isEdit = !!person
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [err, setErr]             = useState('')
  const fileInputRef              = useRef<HTMLInputElement>(null)

  const [name, setName]             = useState(person?.name || '')
  const [isCustomType, setIsCustomType] = useState(!!person?.type && person.type !== 'Human')
  const [customType, setCustomType] = useState(person?.type && person.type !== 'Human' ? person.type : '')
  const [photo, setPhoto]           = useState(person?.photo || '')
  const [photoTab, setPhotoTab]     = useState<'url'|'upload'>('url')
  const [birthDate, setBirthDate]   = useState(parseToInputDate(person?.birthDate || ''))
  const [birthPlace, setBirthPlace] = useState(person?.birthPlace || '')
  const [isDeceased, setIsDeceased] = useState(person?.isDeceased || false)
  const [deathDate, setDeathDate]   = useState(parseToInputDate(person?.deathDate || ''))
  const [manualGen, setManualGen]   = useState<string>(person?.manualGen !== undefined ? String(person.manualGen) : '')
  const [customFields, setCustomFields] = useState<Record<string,string>>(person?.customFields || {})

  const cloudinaryReady = !!(CLOUD_NAME && UPLOAD_PRESET)
  const finalType = isCustomType ? customType.trim() : 'Human'

  const handleUpload = async (file: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Please select an image file'); return }
    if (file.size > 10 * 1024 * 1024) { setErr('Image must be smaller than 10MB'); return }
    if (!cloudinaryReady) { setErr('Cloudinary not configured. Use URL tab instead.'); return }
    setUploading(true); setErr('')
    try {
      const url = await uploadToCloudinary(file, CLOUD_NAME, UPLOAD_PRESET, pct => setUploadPct(pct))
      setPhoto(url)
    } catch { setErr('Upload failed. Please try again or use a URL.') }
    setUploading(false); setUploadPct(0)
  }

  const handleSave = async () => {
    if (!name.trim()) { setErr('Name is required'); return }
    if (uploading) { setErr('Please wait for upload to finish'); return }
    setSaving(true)
    try {
      const p: Omit<Person, 'id'> = {
        name: name.trim(),
        x: person?.x ?? initialX ?? 200 + Math.random() * 500,
        y: person?.y ?? initialY ?? 150 + Math.random() * 300,
      }
      if (finalType)      p.type       = finalType
      if (photo.trim())   p.photo      = photo.trim()
      if (birthDate)      p.birthDate  = birthDate
      if (birthPlace)     p.birthPlace = birthPlace.trim()
      if (isDeceased)     { p.isDeceased = true; if (deathDate) p.deathDate = deathDate }
      else                 { p.isDeceased = false; p.deathDate = '' }
      if (manualGen !== '') p.manualGen = parseInt(manualGen)
      const cf: Record<string,string> = {}
      ;(tree.customFieldDefs || []).forEach(f => { if (customFields[f]) cf[f] = customFields[f] })
      if (Object.keys(cf).length > 0) p.customFields = cf
      await onSave(p)
    } catch { setErr('Failed to save. Please try again.'); setSaving(false) }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.scroll}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{isEdit ? 'Edit person' : 'Add person'}</h2>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          {/* Name */}
          <div className={styles.group}>
            <label className={styles.label}>Name <span className={styles.req}>*</span></label>
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="Full name" autoFocus />
          </div>

          {/* Type */}
          <div className={styles.group}>
            <label className={styles.label}>Type / Role</label>
            <div className={styles.typeToggle}>
              <button className={`${styles.typeToggleBtn} ${!isCustomType ? styles.typeToggleBtnActive : ''}`}
                onClick={() => setIsCustomType(false)}>Human</button>
              <button className={`${styles.typeToggleBtn} ${isCustomType ? styles.typeToggleBtnActive : ''}`}
                onClick={() => setIsCustomType(true)}>✏️ Custom...</button>
            </div>
            {isCustomType && (
              <input className={styles.input} style={{ marginTop:10 }}
                placeholder="e.g. God, Goddess, Pharaoh..."
                value={customType} onChange={e => setCustomType(e.target.value)} autoFocus />
            )}
          </div>

          {/* Photo */}
          <div className={styles.group}>
            <label className={styles.label}>Photo</label>
            <div className={styles.photoTabs}>
              <button className={`${styles.photoTab} ${photoTab==='url'?styles.photoTabActive:''}`} onClick={() => setPhotoTab('url')}>🔗 URL</button>
              <button className={`${styles.photoTab} ${photoTab==='upload'?styles.photoTabActive:''}`} onClick={() => setPhotoTab('upload')}>📁 Upload</button>
            </div>
            {photoTab === 'url' && (
              <input className={styles.input} style={{ marginTop:8 }} value={photo}
                onChange={e => setPhoto(e.target.value)} placeholder="https://..." type="url" inputMode="url" />
            )}
            {photoTab === 'upload' && (
              <div className={styles.uploadArea}>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
                {!cloudinaryReady && <div className={styles.uploadNotice}>⚠️ Add Cloudinary credentials to .env to enable uploads.</div>}
                {cloudinaryReady && (uploading
                  ? <div className={styles.uploadProgress}><div className={styles.progressBar}><div className={styles.progressFill} style={{ width:`${uploadPct}%` }} /></div><span className={styles.uploadPct}>{uploadPct}%</span></div>
                  : <button className={styles.uploadBtn} onClick={() => fileInputRef.current?.click()}>{photo ? '📷 Change photo' : '📷 Choose from device'}</button>
                )}
                <p className={styles.uploadHint}>JPG, PNG, WEBP — max 10MB</p>
              </div>
            )}
            {photo && (
              <div className={styles.photoPreview}>
                <img src={photo} alt="" />
                <button className={styles.photoRemove} onClick={() => setPhoto('')}>✕ Remove</button>
              </div>
            )}
          </div>

          {/* Vital status */}
          <div className={styles.group}>
            <label className={styles.label}>Status</label>
            <div className={styles.typeToggle}>
              <button className={`${styles.typeToggleBtn} ${!isDeceased ? styles.typeToggleBtnActive : ''}`}
                onClick={() => setIsDeceased(false)}>🟢 Alive</button>
              <button className={`${styles.typeToggleBtn} ${isDeceased ? styles.typeToggleBtnActive : ''}`}
                onClick={() => setIsDeceased(true)}>⚫ Deceased</button>
            </div>
          </div>

          {/* Birth date & place */}
          <div className={styles.row}>
            <div className={styles.group} style={{ flex:1 }}>
              <label className={styles.label}>Birth date</label>
              <input className={styles.input} type="date"
                value={birthDate || '2000-01-01'}
                onChange={e => setBirthDate(e.target.value)} />
            </div>
            <div className={styles.group} style={{ flex:1 }}>
              <label className={styles.label}>Birth place</label>
              <input className={styles.input} value={birthPlace}
                onChange={e => setBirthPlace(e.target.value)} placeholder="e.g. Athens" />
            </div>
          </div>

          {/* Death date — only if deceased */}
          {isDeceased && (
            <div className={styles.group}>
              <label className={styles.label}>Death date <span style={{ color:'var(--c-text-3)',fontSize:11 }}>(optional)</span></label>
              <input className={styles.input} type="date"
                value={deathDate || ''}
                onChange={e => setDeathDate(e.target.value)} />
            </div>
          )}

          {/* Generation override */}
          <div className={styles.group}>
            <label className={styles.label}>Generation level <span style={{ color:'var(--c-text-3)',fontWeight:400,fontSize:11 }}>(optional)</span></label>
            <input className={styles.input} type="number" value={manualGen}
              onChange={e => setManualGen(e.target.value)}
              placeholder="e.g. 0 = oldest, 1 = next..." />
          </div>

          {/* Custom fields */}
          {(tree.customFieldDefs || []).map(f => (
            <div key={f} className={styles.group}>
              <label className={styles.label}>{f}</label>
              <input className={styles.input} value={customFields[f] || ''}
                onChange={e => setCustomFields(prev => ({ ...prev, [f]: e.target.value }))}
                placeholder={f} />
            </div>
          ))}

          {err && <div className={styles.err}>{err}</div>}

          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving || uploading}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add person'}
          </button>
          {isEdit && onDelete && (
            <button className={styles.btnDanger} onClick={onDelete}>Delete person</button>
          )}
        </div>
      </div>
    </div>
  )
}
