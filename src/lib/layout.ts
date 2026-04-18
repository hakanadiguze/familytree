// Strict hierarchical layout
// Rules (in priority order):
//   1. Manual gen override (manualGen map) → person starts at that gen
//   2. Spouse → same gen (MAX, then fix parents if gap created)
//   3. Parent → Child: child gen = parent gen + 1 (strict, no gaps)
//   4. Siblings → same gen (MAX among siblings, then fix parents)

import { Person, Relation } from './db'

export function computeLayout(
  people: Person[],
  relations: Relation[],
  manualGens?: Map<string, number>   // personId → forced gen level
): { id: string; x: number; y: number }[] {
  const n = people.length
  if (n === 0) return []

  const idx = new Map<string, number>()
  people.forEach((p, i) => idx.set(p.id, i))

  const childrenOf: number[][] = Array.from({ length: n }, () => [])
  const parentsOf:  number[][] = Array.from({ length: n }, () => [])
  const spousePairs: [number, number][] = []

  for (const r of relations) {
    const fi = idx.get(r.from), ti = idx.get(r.to)
    if (fi === undefined || ti === undefined) continue
    if (r.type === 'Parent') {
      if (!childrenOf[fi].includes(ti)) childrenOf[fi].push(ti)
      if (!parentsOf[ti].includes(fi))  parentsOf[ti].push(fi)
    } else if (r.type === 'Spouse' || r.type === 'Partner') {
      const key = `${Math.min(fi,ti)}-${Math.max(fi,ti)}`
      if (!spousePairs.some(([a,b]) => `${Math.min(a,b)}-${Math.max(a,b)}` === key))
        spousePairs.push([fi, ti])
    }
  }

  // ── Step 1: Initial gen — top-down BFS from roots ─────────
  const gen: number[] = new Array(n).fill(-1)
  const queue: number[] = []
  for (let i = 0; i < n; i++)
    if (parentsOf[i].length === 0) { gen[i] = 0; queue.push(i) }
  let qi = 0
  while (qi < queue.length) {
    const node = queue[qi++]
    for (const child of childrenOf[node]) {
      const ng = gen[node] + 1
      if (gen[child] < ng) { gen[child] = ng; queue.push(child) }
    }
  }
  for (let i = 0; i < n; i++) if (gen[i] < 0) gen[i] = 0

  // ── Step 2: Apply manual gen overrides ────────────────────
  if (manualGens) {
    manualGens.forEach((g, pid) => {
      const i = idx.get(pid)
      if (i !== undefined) gen[i] = g
    })
  }

  // ── Step 3: Propagate constraints iteratively ─────────────
  // Spouse: same gen (MAX)
  // Parent-child: child = parent + 1 (strict)
  // Siblings: same gen (MAX)
  // Build sibling groups
  const childParentKey = new Map<number, string>()
  for (let i = 0; i < n; i++)
    if (parentsOf[i].length > 0)
      childParentKey.set(i, [...parentsOf[i]].sort().join('|'))
  const keyToSibs = new Map<string, number[]>()
  childParentKey.forEach((key, child) => {
    if (!keyToSibs.has(key)) keyToSibs.set(key, [])
    keyToSibs.get(key)!.push(child)
  })
  const siblingGroups = Array.from(keyToSibs.values()).filter(g => g.length > 1)

  let changed = true
  let iters = 0
  while (changed && iters < 200) {
    changed = false; iters++

    // Spouse: same gen (MAX — pull lower one up)
    for (const [a, b] of spousePairs) {
      const t = Math.max(gen[a], gen[b])
      if (gen[a] !== t) { gen[a] = t; changed = true }
      if (gen[b] !== t) { gen[b] = t; changed = true }
    }

    // Parent-child: child MUST be parent + 1
    for (let i = 0; i < n; i++) {
      for (const c of childrenOf[i]) {
        const expected = gen[i] + 1
        if (gen[c] !== expected) { gen[c] = expected; changed = true }
      }
    }

    // Siblings: same gen (MAX)
    for (const group of siblingGroups) {
      const maxG = Math.max(...group.map(i => gen[i]))
      for (const i of group)
        if (gen[i] !== maxG) { gen[i] = maxG; changed = true }
    }
  }

  // ── Step 4: Group by gen ──────────────────────────────────
  const genGroups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    if (!genGroups.has(gen[i])) genGroups.set(gen[i], [])
    genGroups.get(gen[i])!.push(i)
  }
  const genValues = Array.from(genGroups.keys()).sort((a, b) => a - b)

  const spouseOf = new Map<number, number>()
  for (const [a, b] of spousePairs) { spouseOf.set(a, b); spouseOf.set(b, a) }
  const sibGrpOf = new Map<number, number[]>()
  for (const group of siblingGroups)
    for (const i of group) sibGrpOf.set(i, group)

  const H_GAP = 210, V_GAP = 230, MARGIN_Y = 80, CENTER_X = 800
  const pos: { x: number; y: number }[] = new Array(n).fill(null).map(() => ({ x: 0, y: 0 }))

  // Map gen values to row indices (handles negative gens from manual override)
  const minGen = Math.min(...genValues)
  const rowOf = (g: number) => g - minGen

  // ── Step 5: Layout each gen row ───────────────────────────
  for (const g of genValues) {
    const members = (genGroups.get(g) || []).slice()
    const y = MARGIN_Y + rowOf(g) * V_GAP

    const avgParentX = (i: number) => {
      const pars = parentsOf[i].filter(p => gen[p] < g)
      return pars.length === 0 ? CENTER_X : pars.reduce((s, p) => s + pos[p].x, 0) / pars.length
    }

    // Build clusters: sibling groups contiguous + spouse adjacent
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
    slots.forEach((i, j) => { pos[i] = { x: startX + j * H_GAP, y } })
  }

  return people.map((p, i) => ({ id: p.id, x: pos[i].x, y: pos[i].y }))
}

// Export gen values for swimlane rendering
export function computeGenLevels(
  people: Person[],
  relations: Relation[],
  manualGens?: Map<string, number>
): Map<string, number> {
  const result = new Map<string, number>()
  const positions = computeLayout(people, relations, manualGens)
  // We need the gen values — recalculate inline
  // (simpler: just return y positions and let caller infer rows)
  return result
}
