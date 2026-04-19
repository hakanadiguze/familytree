import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, serverTimestamp, writeBatch, deleteField
} from 'firebase/firestore'
import { db } from './firebase'
import { nanoid } from 'nanoid'

export interface Person {
  id: string
  name: string
  type?: string
  photo?: string
  birthDate?: string
  birthPlace?: string
  isDeceased?: boolean
  deathDate?: string
  customFields?: Record<string, string>
  manualGen?: number
  x: number
  y: number
}

export interface Relation {
  id: string
  from: string
  to: string
  type: string
}

export interface Tree {
  id: string
  title: string
  description?: string
  category?: string
  shareSlug: string
  isPublic: boolean
  ownerId: string
  ownerName?: string
  customFieldDefs: string[]
  coAdmins: string[]
  showType: boolean    // show type/role label on nodes
  createdAt: unknown
  updatedAt: unknown
}

// ─── Trees ────────────────────────────────────────────────────────────────────

export async function createTree(uid: string, ownerName: string, data: {
  title: string; description?: string; category?: string
}): Promise<string> {
  const shareSlug = nanoid(10)
  const ref = await addDoc(collection(db, 'trees'), {
    ...data,
    ownerId: uid,
    ownerName,
    shareSlug,
    isPublic: true,
    customFieldDefs: [],
    coAdmins: [],
    showType: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function getUserTrees(uid: string): Promise<Tree[]> {
  const q = query(collection(db, 'trees'), where('ownerId', '==', uid))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Tree))
}

export async function getCoAdminTrees(uid: string): Promise<Tree[]> {
  const q = query(collection(db, 'trees'), where('coAdmins', 'array-contains', uid))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Tree))
}

export async function getTreeBySlug(slug: string): Promise<Tree | null> {
  const q = query(collection(db, 'trees'), where('shareSlug', '==', slug))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Tree
}

export async function getTreeById(id: string): Promise<Tree | null> {
  const snap = await getDoc(doc(db, 'trees', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Tree
}

export async function updateTree(id: string, data: Partial<Tree>) {
  await updateDoc(doc(db, 'trees', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteTree(id: string) {
  const batch = writeBatch(db)
  const people = await getDocs(collection(db, 'trees', id, 'people'))
  people.docs.forEach(d => batch.delete(d.ref))
  const relations = await getDocs(collection(db, 'trees', id, 'relations'))
  relations.docs.forEach(d => batch.delete(d.ref))
  batch.delete(doc(db, 'trees', id))
  await batch.commit()
}

// ─── People ───────────────────────────────────────────────────────────────────

export async function getPeople(treeId: string): Promise<Person[]> {
  const snap = await getDocs(collection(db, 'trees', treeId, 'people'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Person))
}

export async function addPerson(treeId: string, person: Omit<Person, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'trees', treeId, 'people'), person)
  return ref.id
}

export async function updatePerson(treeId: string, personId: string, data: Partial<Person>) {
  // Build update object, using deleteField() for explicitly false/empty values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v === false || v === '' || v === null || v === undefined) {
      update[k] = deleteField()
    } else {
      update[k] = v
    }
  }
  await updateDoc(doc(db, 'trees', treeId, 'people', personId), update)
}

export async function deletePerson(treeId: string, personId: string) {
  await deleteDoc(doc(db, 'trees', treeId, 'people', personId))
}

// ─── Relations ────────────────────────────────────────────────────────────────

export async function getRelations(treeId: string): Promise<Relation[]> {
  const snap = await getDocs(collection(db, 'trees', treeId, 'relations'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Relation))
}

export async function addRelation(treeId: string, relation: Omit<Relation, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'trees', treeId, 'relations'), relation)
  return ref.id
}

export async function deleteRelation(treeId: string, relationId: string) {
  await deleteDoc(doc(db, 'trees', treeId, 'relations', relationId))
}
