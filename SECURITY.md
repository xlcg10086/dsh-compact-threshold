# Security Policy

## Reporting a vulnerability

Please report security issues privately via GitHub Security Advisories on
<https://github.com/xlcg10086/dsh-compact-threshold/security/advisories/new>.

Do not open a public issue for a vulnerability before a fix is available.

## Scope

`dsh-compact-threshold` only reads the local DSH token meter and modifies the
running compaction engine's in-memory configuration. It does not make network
requests, execute shell commands, or collect telemetry.
