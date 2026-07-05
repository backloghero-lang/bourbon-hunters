# Bourbon Hunters - Password Reset Email Template

Subject: Reset your Bourbon Hunters password

Preheader: Use this secure link to set a new password.

Hi {{username}},

We received a request to reset the password for your Bourbon Hunters account.

Reset your password:
{{reset_url}}

This link should expire after {{expiry_minutes}} minutes. If you did not request a password reset, you can ignore this email.

Cheers,
Bourbon Hunters

---

Operational notes:
- Send only after real email delivery is connected.
- Required variables: `username`, `reset_url`, `expiry_minutes`.
- Password reset tokens must be single-use and stored hashed in the backend.
