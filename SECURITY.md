# SECURITY

- Passwords are hashed with bcrypt.
- Session tokens are stored server-side and set using HTTP-only cookies.
- Role-based access checks are enforced server-side for protected APIs.
- Structured API error responses avoid leaking internals.
- Explicit "not configured" states are returned when required integration credentials are missing.
- Audit logs are persisted for sensitive operations.
