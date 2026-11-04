# TechCon: Project Showcase and Evaluation System

## Local demo

The current application is a React/Vite demonstration backed by seeded records and browser `localStorage`. It has no connected backend. Stored data is local to one browser profile and is not shared across users or devices. The mock login, shared password, and in-memory demo token are not secure authentication and must not be used for production.

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

Demo accounts are listed on the login screen. Their shared password is `techcon123`; these are mock accounts, not production credentials. In development mode, the administrator account can access the demo publication and reset controls. Results publication and rating visibility change display settings only and do not delete evaluation records.

## Backend integration still required

`src/config/apiConfig.js` provides an API request helper, but the application services currently use local demo data and do not call it. Connecting a real service requires implementing and documenting backend endpoints and response contracts for authentication/session lifecycle, projects/groups/users, evaluation eligibility and assignment, evaluation submission/history/aggregates, and settings. The backend must enforce authentication, role authorization, self-evaluation and duplicate prevention, evaluation limits, rating/comment validation, privacy, and publication/visibility rules. It also needs persistent database migrations, secret/token handling, and appropriate audit and error handling. A `VITE_API_URL` value alone does not connect the current services to a backend.

Evaluation criteria and weights are placeholders; the current demo retains the existing equal-weight average, free-selection strategy, and five-evaluation limit. Instructor/project-owner confirmation is needed before changing those rules or defining real assigned evaluations.
