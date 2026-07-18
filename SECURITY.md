# Security Policy

## Supported Version

Security updates are applied to the latest revision of the `main` branch.

## Reporting a Vulnerability

Please use GitHub private vulnerability reporting when available. Do not open a
public issue containing exploit details or sensitive information.

## Credential Policy

- Private keys, RPC credentials, and write tokens must be supplied through the
  process environment.
- `.env` files are ignored and must never be committed.
- The documented deployment uses a dedicated Sepolia-only wallet.
- Production funds and production infrastructure are outside this project's
  scope.
