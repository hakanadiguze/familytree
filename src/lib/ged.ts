// GEDCOM 5.5.1 — import & export
import { Person, Relation } from './db'

// ─── EXPORT ───────────────────────────────────────────────────────────────────

export function exportGED(people: Person[], relations: Relation[], treeName: string): string {
  const L: string[] = []
  const now = new Date()
  const MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const dateStr = `${now.getDate()} ${MON[now.getMonth()]} ${now.getFullYear()}`

  L.push('0 HEAD')
  L.push('1 SOUR FamilyTreeApp')
  L.push('2 NAME Family Tree App')
  L.push('2 VERS 1.0')
  L.push('1 GEDC')
  L.push('2 VERS 5.5.1')
  L.push('2 FORM LINEAGE-LINKED')
  L.push('1 CHAR UTF-8')
  L.push(`1 DATE ${dateStr}`)
  L.push('1 SUBM @SUBM1@')
  L.push('0 @SUBM1@ SUBM')
  L.push(`1 NAME ${treeName}`)

  type Fam = { id: string; husbId?: string; wifeId?: string; childIds: string[] }
  const famList: Fam[] = []
  let fc = 1

  relations.filter(r => r.type === 'Spouse' || r.type === 'Partner').forEach(r => {
    famList.push({ id: `F${fc++}`, husbId: r.from, wifeId: r.to, childIds: [] })
  })
  relations.filter(r => r.type === 'Parent').forEach(r => {
    const ex = famList.find(f => f.husbId === r.from || f.wifeId === r.from)
    if (ex) { if (!ex.childIds.includes(r.to)) ex.childIds.push(r.to) }
    else famList.push({ id: `F${fc++}`, husbId: r.from, childIds: [r.to] })
  })

  const famsMap = new Map<string, string[]>()
  const famcMap = new Map<string, string>()
  famList.forEach(f => {
    const addFams = (pid: string) => { if (!famsMap.has(pid)) famsMap.set(pid, []); famsMap.get(pid)!.push(f.id) }
    if (f.husbId) addFams(f.husbId)
    if (f.wifeId) addFams(f.wifeId)
    f.childIds.forEach(c => famcMap.set(c, f.id))
  })

  const gedId = (pid: string) => { const i = people.findIndex(p => p.id === pid); return i >= 0 ? `I${i+1}` : null }

  people.forEach((p, idx) => {
    const gid = `I${idx+1}`
    L.push(`0 @${gid}@ INDI`)
    const parts = p.name.trim().split(' ')
    const surname = parts.length > 1 ? parts[parts.length - 1] : ''
    const given   = parts.slice(0, parts.length > 1 ? -1 : 1).join(' ')
    L.push(`1 NAME ${given} /${surname}/`)
    if (p.type)       L.push(`1 OCCU ${p.type}`)
    if (p.birthDate || p.birthPlace) {
      L.push('1 BIRT')
      if (p.birthDate)  L.push(`2 DATE ${p.birthDate}`)
      if (p.birthPlace) L.push(`2 PLAC ${p.birthPlace}`)
    }
    if (p.photo)      { L.push('1 OBJE'); L.push(`2 FILE ${p.photo}`); L.push('2 FORM URL') }
    if (p.customFields) {
      Object.entries(p.customFields).forEach(([k, v]) => {
        if (v) L.push(`1 NOTE _${k.toUpperCase().replace(/\s+/g,'_')}: ${v}`)
      })
    }
    ;(famsMap.get(p.id) || []).forEach(fid => L.push(`1 FAMS @${fid}@`))
    const fc2 = famcMap.get(p.id)
    if (fc2) L.push(`1 FAMC @${fc2}@`)
  })

  famList.forEach(f => {
    L.push(`0 @${f.id}@ FAM`)
    if (f.husbId) { const g = gedId(f.husbId); if (g) L.push(`1 HUSB @${g}@`) }
    if (f.wifeId) { const g = gedId(f.wifeId); if (g) L.push(`1 WIFE @${g}@`) }
    f.childIds.forEach(c => { const g = gedId(c); if (g) L.push(`1 CHIL @${g}@`) })
  })

  L.push('0 TRLR')
  return L.join('\r\n')
}

export function downloadGED(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (filename.endsWith('.ged') ? filename : filename + '.ged').replace(/[^\w.\-]/g, '_')
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ─── HIERARCHICAL LAYOUT (bottom-up) ─────────────────────────────────────────
// Rules:
//   1. Start from leaves (youngest, no children) — placed at the BOTTOM.
//   2. Parents are placed ABOVE their children.
//   3. Spouses get the SAME depth row (use the deeper/younger one).
//   4. Spouses are placed ADJACENT to each other.
//   5. Siblings ordered by children's x positions (barycenter) to reduce crossings.

function computeHierarchicalLayout(
  count: number,
  parentEdges: [number, number][],
  spousePairs: [number, number][]
): { x: number; y: number }[] {
  const H_GAP = 210, V_GAP = 230, MARGIN_Y = 80, CENTER_X = 800

  const childrenOf: number[][] = Array.from({ length: count }, () => [])
  const parentsOf:  number[][] = Array.from({ length: count }, () => [])
  parentEdges.forEach(([p, c]) => {
    if (!childrenOf[p].includes(c)) childrenOf[p].push(c)
    if (!parentsOf[c].includes(p))  parentsOf[c].push(p)
  })

  // Top-down initial gen
  const gen: number[] = new Array(count).fill(-1)
  const queue: number[] = []
  for (let i = 0; i < count; i++)
    if (parentsOf[i].length === 0) { gen[i] = 0; queue.push(i) }
  let qi = 0
  while (qi < queue.length) {
    const node = queue[qi++]
    for (const child of childrenOf[node]) {
      const ng = gen[node] + 1
      if (gen[child] < ng) { gen[child] = ng; queue.push(child) }
    }
  }
  for (let i = 0; i < count; i++) if (gen[i] < 0) gen[i] = 0

  // Sibling groups
  const childParentMap = new Map<number, string>()
  for (let i = 0; i < count; i++)
    if (parentsOf[i].length > 0)
      childParentMap.set(i, [...parentsOf[i]].sort().join('|'))
  const keyToSibs = new Map<string, number[]>()
  childParentMap.forEach((key, child) => {
    if (!keyToSibs.has(key)) keyToSibs.set(key, [])
    keyToSibs.get(key)!.push(child)
  })
  const siblingGroups = Array.from(keyToSibs.values()).filter(g => g.length > 1)

  // Strict propagation: spouse=same(MAX), child=parent+1, siblings=same(MAX)
  let changed = true; let iters = 0
  while (changed && iters < 200) {
    changed = false; iters++
    for (const [a, b] of spousePairs) {
      const t = Math.max(gen[a], gen[b])
      if (gen[a] !== t) { gen[a] = t; changed = true }
      if (gen[b] !== t) { gen[b] = t; changed = true }
    }
    for (let i = 0; i < count; i++)
      for (const c of childrenOf[i])
        if (gen[c] !== gen[i] + 1) { gen[c] = gen[i] + 1; changed = true }
    for (const group of siblingGroups) {
      const maxG = Math.max(...group.map(i => gen[i]))
      for (const i of group)
        if (gen[i] !== maxG) { gen[i] = maxG; changed = true }
    }
  }

  // Group by gen
  const genGroups = new Map<number, number[]>()
  for (let i = 0; i < count; i++) {
    if (!genGroups.has(gen[i])) genGroups.set(gen[i], [])
    genGroups.get(gen[i])!.push(i)
  }
  const genValues = Array.from(genGroups.keys()).sort((a,b) => a-b)
  const minGen = Math.min(...genValues)

  const spouseOf = new Map<number, number>()
  for (const [a, b] of spousePairs) { spouseOf.set(a, b); spouseOf.set(b, a) }
  const sibGrpOf = new Map<number, number[]>()
  for (const group of siblingGroups)
    for (const i of group) sibGrpOf.set(i, group)

  const pos: { x: number; y: number }[] = new Array(count).fill(null).map(() => ({ x: 0, y: 0 }))

  for (const g of genValues) {
    const members = (genGroups.get(g) || []).slice()
    const y = MARGIN_Y + (g - minGen) * V_GAP

    const avgParentX = (i: number) => {
      const pars = parentsOf[i].filter(p => gen[p] < g)
      return pars.length === 0 ? CENTER_X : pars.reduce((s, p) => s + pos[p].x, 0) / pars.length
    }

    const clusters: number[][] = []
    const assigned = new Set<number>()
    for (const i of members) {
      if (assigned.has(i)) continue
      const sibGroup = sibGrpOf.get(i)
      if (sibGroup) {
        const inRow = sibGroup.filter(s => members.includes(s) && !assigned.has(s))
        if (inRow.length > 0) {
          inRow.sort((a, b) => avgParentX(a) - avgParentX(b))
          const cluster: number[] = []
          for (const sib of inRow) {
            cluster.push(sib); assigned.add(sib)
            const sp = spouseOf.get(sib)
            if (sp !== undefined && members.includes(sp) && !assigned.has(sp)) {
              cluster.push(sp); assigned.add(sp)
            }
          }
          clusters.push(cluster)
        }
      }
    }
    for (const i of members) {
      if (assigned.has(i)) continue
      const sp = spouseOf.get(i)
      if (sp !== undefined && members.includes(sp) && !assigned.has(sp)) {
        clusters.push([i, sp]); assigned.add(i); assigned.add(sp)
      } else { clusters.push([i]); assigned.add(i) }
    }
    clusters.sort((ca, cb) => {
      const avg = (cl: number[]) => cl.reduce((s, i) => s + avgParentX(i), 0) / cl.length
      return avg(ca) - avg(cb)
    })
    const slots = clusters.flat()
    const totalW = (slots.length - 1) * H_GAP
    const startX = CENTER_X - totalW / 2
    slots.forEach((idx, j) => { pos[idx] = { x: startX + j * H_GAP, y } })
  }
  return pos
  return pos
}

// ─── IMPORT ───────────────────────────────────────────────────────────────────

export function parseGED(content: string): {
  people: Omit<Person, 'id'>[]
  relations: Omit<Relation, 'id'>[]
} {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  interface RawP {
    gedId: string; name: string; sex?: string; type?: string; photo?: string
    birthDate?: string; birthPlace?: string; deathDate?: string; deathPlace?: string
    customFields: Record<string, string>; fams: string[]; famc?: string
  }
  interface RawF { gedId: string; husbId?: string; wifeId?: string; childIds: string[] }

  const indis = new Map<string, RawP>()
  const fams  = new Map<string, RawF>()
  let ci: RawP | null = null
  let cf: RawF | null = null
  let inBirt = false, inDeat = false, inObje = false

  const flush = () => {
    if (ci) indis.set(ci.gedId, ci)
    if (cf) fams.set(cf.gedId, cf)
    ci = null; cf = null; inBirt = false; inDeat = false; inObje = false
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    const i1 = line.indexOf(' '); if (i1 < 0) continue
    const level = parseInt(line.slice(0, i1)); if (isNaN(level)) continue
    const rest = line.slice(i1 + 1)
    const i2 = rest.indexOf(' ')
    const tag = i2 >= 0 ? rest.slice(0, i2) : rest
    const val = i2 >= 0 ? rest.slice(i2 + 1) : ''

    if (level === 0) {
      flush()
      if (tag.startsWith('@') && tag.endsWith('@')) {
        const xref = tag.slice(1, -1); const rtype = val.trim()
        if (rtype === 'INDI') ci = { gedId: xref, name: '', customFields: {}, fams: [] }
        else if (rtype === 'FAM') cf = { gedId: xref, childIds: [] }
      }
      continue
    }

    if (ci) {
      if (level === 1) { inBirt = false; inDeat = false; inObje = false }
      if (tag === 'NAME'  && level === 1) ci.name       = val.replace(/\//g,'').replace(/\s+/g,' ').trim()
      if (tag === 'SEX'   && level === 1) ci.sex        = val.trim()
      if (tag === 'OCCU'  && level === 1) ci.type       = val.trim()
      if (tag === 'BIRT'  && level === 1) inBirt        = true
      if (tag === 'DEAT'  && level === 1) inDeat        = true
      if (tag === 'OBJE'  && level === 1) inObje        = true
      if (tag === 'DATE'  && level === 2 && inBirt) ci.birthDate  = val.trim()
      if (tag === 'PLAC'  && level === 2 && inBirt) ci.birthPlace = val.trim()
      if (tag === 'DATE'  && level === 2 && inDeat) ci.deathDate  = val.trim()
      if (tag === 'FILE'  && level === 2 && inObje && val.startsWith('http')) ci.photo = val.trim()
      if (tag === 'NOTE'  && level === 1) {
        if (val.startsWith('PHOTO:')) ci.photo = val.slice(6).trim()
        else if (val.startsWith('_')) {
          const colon = val.indexOf(':')
          if (colon > 0) ci.customFields[val.slice(1,colon).replace(/_/g,' ')] = val.slice(colon+1).trim()
        }
      }
      if (tag === 'FAMS'  && level === 1) ci.fams.push(val.replace(/@/g,'').trim())
      if (tag === 'FAMC'  && level === 1) ci.famc = val.replace(/@/g,'').trim()
    }

    if (cf) {
      if (tag === 'HUSB' && level === 1) cf.husbId = val.replace(/@/g,'').trim()
      if (tag === 'WIFE' && level === 1) cf.wifeId = val.replace(/@/g,'').trim()
      if (tag === 'CHIL' && level === 1) cf.childIds.push(val.replace(/@/g,'').trim())
    }
  }
  flush()

  if (indis.size === 0) throw new Error('No INDI records found — not a valid GED file')

  const indiArr = Array.from(indis.values())
  const idxMap  = new Map<string, number>()
  indiArr.forEach((p, i) => idxMap.set(p.gedId, i))

  // Build parent edges and spouse pairs for layout
  const parentEdges: [number, number][] = []
  const spousePairs: [number, number][] = []
  const edgeSeen = new Set<string>()

  fams.forEach(fam => {
    const hi = fam.husbId ? idxMap.get(fam.husbId) : undefined
    const wi = fam.wifeId ? idxMap.get(fam.wifeId) : undefined
    // Spouse pair
    if (hi !== undefined && wi !== undefined) {
      const sk = `${Math.min(hi,wi)}-${Math.max(hi,wi)}-sp`
      if (!edgeSeen.has(sk)) { edgeSeen.add(sk); spousePairs.push([hi, wi]) }
    }
    // Parent-child edges
    fam.childIds.forEach(cid => {
      const ci2 = idxMap.get(cid)
      if (ci2 === undefined) return
      ;[hi, wi].forEach(pi => {
        if (pi === undefined) return
        const key = `${pi}-${ci2}`
        if (!edgeSeen.has(key)) { edgeSeen.add(key); parentEdges.push([pi, ci2]) }
      })
    })
  })

  // Compute hierarchical layout with spouse equalisation
  const positions = computeHierarchicalLayout(indiArr.length, parentEdges, spousePairs)

  // Build result people — Firestore-safe (no undefined fields)
  const resultPeople: Omit<Person, 'id'>[] = indiArr.map((p, i) => {
    const cf2: Record<string, string> = {}
    if (p.sex)        cf2['Sex']         = p.sex === 'M' ? 'Male' : p.sex === 'F' ? 'Female' : p.sex
    // deathDate stored as proper field, not custom field
    Object.entries(p.customFields).forEach(([k, v]) => { if (v) cf2[k] = v })

    const person: Omit<Person, 'id'> = {
      name: p.name || 'Unknown',
      x: positions[i].x,
      y: positions[i].y,
    }
    if (p.type)                       person.type        = p.type
    if (p.photo)                      person.photo       = p.photo
    if (p.birthDate)                  person.birthDate   = p.birthDate
    if (p.birthPlace)                 person.birthPlace  = p.birthPlace
    if (p.deathDate)                  { person.deathDate = p.deathDate; (person as Record<string,unknown>).isDeceased = true }
    if (Object.keys(cf2).length > 0)  person.customFields = cf2
    return person
  })

  // Build relations
  const resultRels: Omit<Relation, 'id'>[] = []
  const relSeen = new Set<string>()
  const addRel = (fi: number, ti: number, type: string) => {
    const key = `${fi}-${ti}-${type}`
    if (!relSeen.has(key)) { relSeen.add(key); resultRels.push({ from:`__IDX__${fi}`, to:`__IDX__${ti}`, type }) }
  }

  fams.forEach(fam => {
    const hi = fam.husbId ? idxMap.get(fam.husbId) : undefined
    const wi = fam.wifeId ? idxMap.get(fam.wifeId) : undefined
    if (hi !== undefined && wi !== undefined) addRel(hi, wi, 'Spouse')
    fam.childIds.forEach(cid => {
      const ci2 = idxMap.get(cid)
      if (ci2 === undefined) return
      if (hi !== undefined) addRel(hi, ci2, 'Parent')
      if (wi !== undefined) addRel(wi, ci2, 'Parent')
    })
  })

  return { people: resultPeople, relations: resultRels }
}
