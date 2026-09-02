# Manideep Practice Zone — Interactive MongoDB Practice Application

An interactive, high-performance web application dedicated **exclusively to learning and practicing MongoDB commands**. Features a live MongoDB shell editor, real-time JSON execution output viewer, cloud database persistence on MongoDB Atlas, dynamic student sign-up dropdowns, and an Admin Management Portal.

## 🚀 Features

- **Live MongoDB Shell**: Support for all 27+ core MongoDB command categories (CRUD, aggregation, indexing, schema validation, transaction sessions, user management, and administration).
- **Persistent Cloud Database**: Connects directly to **MongoDB Atlas**. Each student receives their own isolated database sandbox (`user_db_<rollNumber>`).
- **Student Sign-Up with Dynamic Dropdowns**: Roll number, mobile number, password, plus dynamic dropdown selectors for College Name, Branch, and Academic Year.
- **Admin Management Portal (`22KT1A4245` / `manideep`)**:
  - Manage Colleges, Branches, and Academic Years available in student sign-up dropdowns.
  - View all registered students and their Atlas database details.
  - Built-in **MongoDB Command Execution Stage** to inspect or execute queries on any database.
- **Action Confirmation Popups**: Modal confirmation prompts for all sign-out and destructive delete/drop operations (`deleteOne`, `deleteMany`, `drop`, `dropDatabase`).
- **High Concurrency & Vercel Serverless Ready**: Stateless REST API with connection pooling (`maxPoolSize: 100`) optimized for 5,000+ simultaneous users. Zero WebSockets required.

---

## 🛠️ Project Setup & Local Development

### Prerequisites
- **Node.js**: v18+ (Tested on Node.js v22)
- **MongoDB Atlas Connection URI**: Configured in `server/src/db.ts` or `process.env.MONGO_URI`.

### Installation
From the root folder:

```bash
# Install dependencies for client and server
npm run install:all
```

### Running Locally

```bash
# Terminal 1 — Start Server API (Port 3001)
cd server
npm run dev

# Terminal 2 — Start Vite Client (Port 5173)
cd client
npm run dev
```

Open **`http://localhost:5173`** in your browser.

---

## 🔑 Credentials

- **Admin Account**:
  - **Roll Number**: `22KT1A4245`
  - **Password**: `manideep`
- **Student Account**: Create any student account via the Sign Up modal.

---

## ⚡ Deployment to Vercel

This repository includes a pre-configured `vercel.json` and serverless entry point (`api/index.ts`).

### Vercel CLI (Recommended)
```bash
npx vercel
```

### Environment Variable
Set `MONGO_URI` in your Vercel project dashboard to your MongoDB Atlas connection string.
