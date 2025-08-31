# FinDost - AI Financial Coach for Young Indians

FinDost is a full-stack web application that serves as an AI-powered financial coach for young Indians. It provides personalized financial advice, helps users track their goals, and explains complex financial concepts in simple terms.

## Technology Stack

- **Frontend**: React with Vite, Tailwind CSS
- **Backend**: Node.js with Express
- **Database & Auth**: Supabase
- **AI Core**: Google Gemini API

## Project Structure

```
/findost-project
|-- /backend          # Node.js Express server
|-- /frontend         # React application
```

## Features

- Secure user authentication with Google Login via Supabase
- Multi-step onboarding process for new users
- Personalized AI financial coaching through chat
- Data persistence of user profiles and chat history
- Responsive user interface built with Tailwind CSS

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Supabase account with configured project

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Create a `.env.local` (not committed) in `frontend/` based on `.env.example`:
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   ```
   Restart `npm run dev` after adding env vars.

## Supabase Setup Requirements

The application requires the following setup in your Supabase project:

1. Google Auth enabled as a provider (Google Console redirect URI must include `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`)
2. A `profiles` table with the following columns:
   - `id` (uuid, primary key)
   - `full_name` (text)
   - `age` (integer)
   - `profession` (text)
   - `monthly_salary_inr` (integer)
3. A `chats` table with the following columns:
   - `id` (bigint, primary key)
   - `user_id` (uuid, foreign key to auth.users.id)
   - `sender` (text)
   - `message` (text)
   - `created_at` (timestamp with timezone)
4. Row Level Security (RLS) enabled on both tables to ensure users can only access their own data

### Profiles Table Recommended Full Schema & Policies

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  age int,
  gender text,
  profession text,
  monthly_salary_inr int,
  employment_type text,
  average_monthly_expenses int,
  financial_goals text[] default '{}',
  risk_tolerance text,
  investment_experience text,
  has_loans boolean default false,
  loan_types text[] default '{}',
  monthly_loan_payments int,
  communication_preference text,
  notification_frequency text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles Select Own" on public.profiles for select using ( auth.uid() = id );
create policy "Profiles Insert Own" on public.profiles for insert with check ( auth.uid() = id );
create policy "Profiles Update Own" on public.profiles for update using ( auth.uid() = id );
```

### Deploying (Non-Local Domains)

Localhost is only for development; for a persistent domain:
1. Deploy frontend (e.g. Vercel, Netlify) and note the production URL (e.g. `https://app.findost.xyz`).
2. In Supabase Settings → Auth → URL Configuration:
   - Site URL: `https://app.findost.xyz`
   - Additional Redirect URLs: include any preview domains (e.g. `https://*.vercel.app`).
3. Update Google OAuth consent screen & credentials with any new authorized JavaScript origins and redirect URIs.
4. Set environment variables on hosting platform:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. (Optional) Set `VITE_AUTH_REDIRECT_URL` if you need to override redirect detection.

### Multi-Environment (Dev/Prod) Strategy

Use separate Supabase projects or separate schemas. Keep two env files:
```
frontend/.env.development
frontend/.env.production
```
Configure build pipeline to inject correct values.

## License

[MIT](LICENSE)
