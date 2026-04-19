# 🌳 Family Tree App

Create and share beautiful family trees — for families, mythologies, fictional universes, and more.
Developed for **Yami** ❤️

---

## Features

- 🔐 **Google Login** — secure admin access
- 🌳 **Interactive canvas** — pinch to zoom, drag to pan, drag nodes to reposition
- 📱 **Mobile-first** — designed for phones, works perfectly on desktop too
- 🔗 **Share links** — each tree gets a unique public URL (read-only for visitors)
- 👤 **Custom fields** — add any fields: Domain, Dynasty, Symbol, Cause of death, etc.
- 🌐 **Any universe** — Greek gods, Egyptian pharaohs, families, fictional characters
- 📋 **List view** — searchable list of all people in a tree
- ✏️ **Multiple trees** — create, manage, and share as many trees as you want

---

## Setup — 3 steps

### 1. Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. **Firestore Database** → Create database → Start in production mode
4. **Authentication** → Get started → Enable **Google** provider
5. **Project Settings** → Your apps → Add web app → Copy the config values
6. In Firestore → **Rules** tab → paste the contents of `firestore.rules` → Publish
7. *(Optional)* In Firestore → **Indexes** tab → import `firestore.indexes.json`

### 2. GitHub

```bash
cd familytree
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 3. Vercel

1. Go to [vercel.com](https://vercel.com) → Import your GitHub repo
2. Add these **Environment Variables** (from Firebase config):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | your API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | your-project.firebaseapp.com |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | your-project-id |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | your-project.appspot.com |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | your sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | your app ID |
| `NEXT_PUBLIC_APP_URL` | https://your-app.vercel.app |

3. **Also add your Vercel domain to Firebase Auth:**
   - Firebase Console → Authentication → Settings → Authorized domains
   - Add `your-app.vercel.app`

4. Deploy! 🚀

---

## Local development

```bash
cp .env.local.example .env.local
# Fill in your Firebase values

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Tech stack

- **Next.js 14** (App Router)
- **Firebase** (Firestore + Authentication)
- **Vercel** (hosting)
- **TypeScript**

---

*Developed for Yami ❤️*
