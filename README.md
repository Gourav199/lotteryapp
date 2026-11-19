# Lottery Number Tools

Static lottery workspace with a Node.js sign-in API. An administrator creates each username and password from the Accounts page and can read them there. Passwords are encrypted in MongoDB, and the session is an HttpOnly cookie signed for 7 days.

## Local

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI` to a MongoDB Atlas (or local) connection string.
3. Set `JWT_SECRET` to a random string of at least 32 characters.
4. Optional, and only for a new database: set `ADMIN_USERNAME` and `ADMIN_PASSWORD`. The first sign-in copies them into MongoDB. After an administrator account exists, sign-in uses that database record, and the password is changed from the Accounts page.
5. Install and start:

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3000/login.html and sign in with the administrator account stored in MongoDB. The Accounts page creates sign-ins for everyone else and can reset the administrator password.

## Vercel

The site and the API deploy together. Vercel serves the HTML files and runs `api/auth/*.js` as serverless functions. There is no separate always-on server.

1. Create a MongoDB Atlas cluster and a database user.
2. In Atlas Network Access, allow `0.0.0.0/0` so Vercel’s serverless IPs can connect. Use a database user that can only read and write this app’s database.
3. Import this project in Vercel (framework preset: Other).
4. Add environment variables:
   - `MONGODB_URI`
   - `MONGODB_DB` (optional, defaults to `lottery`)
   - `JWT_SECRET`
   - `ADMIN_USERNAME` and `ADMIN_PASSWORD` (optional; used once to create the administrator account when MongoDB does not have one yet)
5. Deploy. The production site is served over HTTPS, and the session cookie is marked Secure. After the administrator account is in MongoDB, you can remove `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Reset that password from the Accounts page.

Endpoints:

- `POST /api/auth/login` — start a session
- `GET /api/auth/me` — current account
- `POST /api/auth/logout` — clear the session
- `GET /api/admin/users` — list usernames and passwords (admin only)
- `POST /api/admin/users` — create an account (admin only)
- `PATCH /api/admin/users` — replace a password, or reset the administrator password (admin only)
