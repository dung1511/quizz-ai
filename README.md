<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# QuizAI

React/Vite frontend with an Express API for document processing and AI question generation.
A separate Django REST Framework API is available under `backend/` for the database-backed
authentication and quiz workflows.

## Run locally

1. Install JavaScript dependencies with `npm install`.
2. Set `GEMINI_API_KEY` in the server environment to enable Gemini question generation. The server retries temporary Gemini errors and falls back from `GEMINI_MODEL` to `GEMINI_FALLBACK_MODEL`; the defaults are `gemini-3.8-flash` and `gemini-3.8-flash`. These settings are server-side only and must not be exposed in the browser.
3. Run Django migrations once: `cd backend; python manage.py migrate`.
4. Start the Django account API with `npm run django:dev`.
5. In another terminal, start the Express document and question API with `npm run backend:dev`.
6. In a third terminal, start Vite with `npm run dev`.

The frontend API proxy targets `http://127.0.0.1:3000` by default; set `VITE_BACKEND_ORIGIN` to override it.
In development Django uses SQLite when `DATABASE_URL` is not configured. For production,
configure `DATABASE_URL` and `DJANGO_SECRET_KEY` before running migrations and starting Django.
