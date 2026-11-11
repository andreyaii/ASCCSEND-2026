# TechCon: Project Showcase and Evaluation System

## App overview

The application is a React/Vite app. Authentication and project listing use the Google Apps Script endpoint configured in `src/config/apiConfig.js`. Student evaluation eligibility, submission, history, and status also use that backend; remaining demo settings, aggregates, and some faculty views still use seeded records and browser `localStorage`.

Install the existing dependencies and start the app:

```sh
npm ci
npm run dev
```

Run the production build and lightweight service tests:

```sh
npm run build
npm test
```

The administrator publication and reset controls are development-only demo features. Results publication and rating visibility change display settings only and do not delete evaluation records.

## Evaluation API

The student login operation issues a six-hour session token stored in Apps Script cache. Authenticated evaluation operations use that token; the backend looks up the student from the session and does not accept a submitted student ID as identity. Submission rules are checked on the server, and a script lock protects duplicate and five-evaluation-limit checks while writing.

The existing `Evaluations` tab must have these columns in order: `EvaluationID, StudentID, GroupCode, ProposalRating, PitchVideoRating, PosterRating, Comment, SubmittedAt`. Ratings are Proposal, Pitch Video, and Poster (1–5); the sheet schema is not modified by the app. After changing `google-apps-script/Code.gs`, redeploy the Apps Script web app so the endpoint runs the updated backend.

The default API base URL can be overridden with `VITE_API_URL`. Remaining backend integration includes moving demo settings, aggregates, and faculty evaluation views to the API, plus production deployment and operational monitoring.
