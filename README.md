# TechCon: Project Showcase and Evaluation System

## App overview

The application is a React/Vite app. Authentication, project listing, evaluation submission and history, faculty group evaluation details, Admin rating analytics, and evaluation settings use the Google Apps Script endpoint configured in `src/config/apiConfig.js`. Ratings, aggregates, and adjustable evaluation settings are read from Google Sheets.

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

Development demo/reset controls and unused sample-data paths have been removed. Browser storage is used for the signed-in session and theme preference, not project, faculty, student, or evaluation records.

## Evaluation API

The student login operation issues a six-hour session token stored in Apps Script cache. Authenticated evaluation operations use that token; the backend looks up the student from the session and does not accept a submitted student ID as identity. Submission rules are checked on the server, and a script lock protects duplicate and five-evaluation-limit checks while writing.

The existing `Evaluations` tab must include these columns: `EvaluationID, StudentID, GroupCode, ResearchPaperRating, PitchVideoRating, PosterRating, LogoRating, Comment, SubmittedAt`. The Apps Script reads and writes by header, so these columns may be in any order. Ratings are Research Paper, Pitch Video, Poster, and Logo (1–5); the sheet schema is not modified by the app. After changing `google-apps-script/Code.gs`, redeploy the Apps Script web app so the endpoint runs the updated backend.

The Admin Rating Analytics page reads all evaluation records through the authenticated `getRatingAnalytics` operation. The operation is restricted to faculty administrators and classifies each evaluator against the live Faculty and Students sheets; unknown historical IDs remain in the combined view. Analytics is read-only and does not change rating submission. Other clients receive only empty aggregate data unless signed in as an Admin, consistent with the rating visibility policy. The Groups sheet's `ResearchPaperLink` resource is shown as the Research Paper link, and evaluation submissions write `ResearchPaperRating`, `PitchVideoRating`, `PosterRating`, and `LogoRating` in the order listed above.

The default API base URL can be overridden with `VITE_API_URL`. Remaining backend integration includes production deployment and operational monitoring.
