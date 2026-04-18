'use client'
import { useRef } from 'react'
import { Person, Relation, Tree } from '@/lib/db'
import styles from './PersonPanel.module.css'

const FAMILY_COLORS = [
  '#534AB7','#0F6E56','#B5400A','#185FA5','#854F0B',
  '#6B2FA0','#0D7A5F','#993C1D','#1A5E8A','#7A3B69','#2E7D32','#B71C1C',
]

function buildFamilyColors(people: Person[], relations: Relation[]): Map<string, string> {
  const colorMap = new Map<string, string>()
  const childParents = new Map<string, string[]>()
  for (const r of relations) {
    if (r.type === 'Parent') {
      if (!childParents.has(r.to)) childParents.set(r.to, [])
      childParents.get(r.to)!.push(r.from)
    }
  }
  const familyColorMap = new Map<string, string>()
  let ci = 0
  childParents.forEach((parentIds, childId) => {
    const key = [...parentIds].sort().join('|')
    if (!familyColorMap.has(key)) { familyColorMap.set(key, FAMILY_COLORS[ci % FAMILY_COLORS.length]); ci++ }
    colorMap.set(childId, familyColorMap.get(key)!)
  })
  people.forEach(p => { if (!colorMap.has(p.id)) colorMap.set(p.id, '#888888') })
  return colorMap
}

function getColor(id: string, colorMap: Map<string, string>) {
  return colorMap.get(id) || '#888888'
}
function getInitials(name: string) {
  return name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?'
}

interface Props {
  person: Person
  tree: Tree
  people: Person[]
  relations: Relation[]
  isAdmin: boolean
  onClose: () => void
  onEdit?: () => void
  onNavigate: (id: string) => void
  onDeleteRelation?: (relationId: string) => void
}

export default function PersonPanel({
  person, tree, people, relations, isAdmin, onClose, onEdit, onNavigate, onDeleteRelation
}: Props) {
  const colorMap = buildFamilyColors(people, relations)
  const color = getColor(person.id, colorMap)
  const panelRef = useRef<HTMLDivElement>(null)

  // Swipe down to close
  const drag = useRef({ active: false, startY: 0, currentY: 0 })
  const handleTouchStart = (e: React.TouchEvent) => {
    drag.current = { active: true, startY: e.touches[0].clientY, currentY: e.touches[0].clientY }
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!drag.current.active) return
    drag.current.currentY = e.touches[0].clientY
    const dy = Math.max(0, drag.current.currentY - drag.current.startY)
    if (panelRef.current) panelRef.current.style.transform = `translateY(${dy}px)`
  }
  const handleTouchEnd = () => {
    const dy = drag.current.currentY - drag.current.startY
    if (dy > 80) { onClose(); return }
    if (panelRef.current) panelRef.current.style.transform = ''
    drag.current.active = false
  }

  // Build connections with relation id for deletion
  const rels = relations.filter(r => r.from === person.id || r.to === person.id)
  const connections = rels.map(r => {
    const otherId = r.from === person.id ? r.to : r.from
    const other = people.find(p => p.id === otherId)
    const label = r.from === person.id ? r.type
      : r.type === 'Parent' ? 'Child'
      : r.type

    return other ? { other, label, relationId: r.id } : null
  }).filter(Boolean) as { other: Person; label: string; relationId: string }[]

  // Sort connections alphabetically by other person's name
  connections.sort((a, b) => a.other.name.localeCompare(b.other.name))

  const stdFields = [
    person.type && { label: 'Type', value: person.type },
    person.birthDate && { label: 'Birth date', value: person.birthDate },
    person.birthPlace && { label: 'Birth place', value: person.birthPlace },
    ...((tree.customFieldDefs || []).map(f =>
      person.customFields?.[f] ? { label: f, value: person.customFields[f] } : null
    ).filter(Boolean) as { label: string; value: string }[]),
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div
        ref={panelRef}
        className={styles.panel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.handle} />
        <div className={styles.scroll}>

          {/* Header */}
          <div className={styles.header}>
            <div className={styles.avatar} style={{ background: color + '20' }}>
              {person.photo
                ? <img src={person.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : <span style={{ color, fontSize: 24 }}>{getInitials(person.name)}</span>}
            </div>
            <div className={styles.headerInfo}>
              <div className={styles.name}>{person.name}</div>
              {person.type && <div className={styles.type}>{person.type}</div>}
            </div>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          {/* Fields */}
          {stdFields.length > 0 && (
            <div className={styles.section}>
              {stdFields.map(f => (
                <div key={f.label} className={styles.field}>
                  <div className={styles.fieldLabel}>{f.label}</div>
                  <div className={styles.fieldValue}>{f.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Connections */}
          {connections.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Connections</div>
              <div className={styles.chips}>
                {connections.map(({ other, label, relationId }) => (
                  <div key={other.id} className={styles.chipRow}>
                    <button
                      className={styles.chip}
                      onClick={() => onNavigate(other.id)}
                    >
                      <div className={styles.chipAvatar}
                        style={{ background: getColor(other.id, colorMap) + '20', color: getColor(other.id, colorMap) }}>
                        {other.photo
                          ? <img src={other.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                          : getInitials(other.name)}
                      </div>
                      <div className={styles.chipInfo}>
                        <div className={styles.chipName}>{other.name}</div>
                        <div className={styles.chipLabel}>{label}</div>
                      </div>
                    </button>
                    {isAdmin && onDeleteRelation && (
                      <button
                        className={styles.chipDelete}
                        title="Remove connection"
                        onClick={() => {
                          if (confirm(`Remove connection between ${person.name} and ${other.name}?`)) {
                            onDeleteRelation(relationId)
                          }
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isAdmin && (
            <button className={styles.editBtn} onClick={onEdit}>Edit person</button>
          )}
        </div>
      </div>
    </>
  )
}
