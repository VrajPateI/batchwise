# Tuition App SaaS

A comprehensive, multi-tenant SaaS application designed to help tuition centers and coaching institutes manage students, attendance, test marks, and fees.

This project is divided into a React/Vite frontend and a Python backend. It uses Supabase as the database and authentication provider, featuring strict Row Level Security (RLS) for tenant isolation.

---

## 🚀 Quick Start Guide

Follow these steps to set up the application for development or production.

### Step 1: Supabase & Database Setup
1. Create a new project on [Supabase](https://supabase.com/).
2. Navigate to the **SQL Editor** in your Supabase dashboard.
3. Open `docs/schema.sql` from this repository, copy its contents, and run it in the SQL Editor. 
   - *This will automatically create all tables, configure Row Level Security (RLS) for multi-tenancy, and deploy the required database functions and triggers.*
4. Go to **Authentication -> Providers -> Email** and ensure email signups are configured according to your needs.
5. In **Authentication -> Providers / Settings**, enable **"Leaked password protection"** for maximum security.

### Step 2: Environment Variables
1. Navigate to the `/frontend` directory and rename `.env.example` to `.env`.
2. Navigate to the `/backend` directory and rename `.env.example` to `.env`.
3. In your Supabase dashboard, go to **Project Settings -> API** to find your keys.
4. Populate the `.env` files with your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Step 3: Run the Frontend (React)
Open a terminal and run the following commands:
```bash
cd frontend
npm install
npm run dev
```
The application will start on `http://localhost:5173`.

### Step 4: Run the Backend (Python)
Open a separate terminal and run the following commands:
```bash
cd backend
python -m venv venv
# On Windows: venv\Scripts\activate
# On Mac/Linux: source venv/bin/activate
pip install -r requirements.txt # (Ensure you install required dependencies like supabase-py, fastAPI, etc.)
python main.py
```

---

## 🏢 How to Onboard a New Institute (Tenant)

This application uses a multi-tenant architecture. Institute administrators cannot sign up directly from the frontend; they must be provisioned by the platform developer (you). 

Follow these exact steps to onboard a new coaching institute client:

### 1. Create the Auth User
- In the Supabase Dashboard, go to **Authentication -> Users**.
- Click **Add User** -> **Create New User**.
- Enter the email and a secure password for the Institute Admin. 
- *Note down the generated `User UID`.*

### 2. Create the Institute Record
- Go to the **Table Editor** -> `institutes` table.
- Insert a new row.
- Provide the `name` (e.g., "Apex Coaching Centre").
- Provide the `address` and `logo_url` (optional).
- Click **Save**.
- *Note down the newly generated `id` (Institute UUID).*

### 3. Link the User to the Institute (Profile Creation)
- Go to the **Table Editor** -> `profiles` table.
- Insert a new row.
- Set the `id` to the **User UID** you copied in Step 1.
- Set the `institute_id` to the **Institute UUID** you copied in Step 2.
- Set the `role` to `admin`.
- Set the `full_name` to the admin's name.
- Click **Save**.

**Done!** The institute admin can now log in to the frontend using the email and password you created. Row Level Security (RLS) will automatically ensure they can only see and manage their own students, tests, and fees.

---

## 🛠️ Tech Stack
- **Frontend:** React 19, Vite, TailwindCSS, Recharts, Flowbite
- **Backend:** Python
- **Database / Auth:** PostgreSQL via Supabase (pgcrypto, Row Level Security)
