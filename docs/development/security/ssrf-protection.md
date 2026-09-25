# SSRF Protection

Applicable to:
- HTTP monitors
- webhooks
- callback URLs
- integrations

## Controls
- parse/normalize URL
- allow only intended schemes
- block loopback/link-local/private ranges according to policy
- resolve DNS and re-check destination
- protect against redirect to blocked network
- limit redirects
- timeout
- response body size limit

Agent-internal monitoring may have different policy because private network access is intentional; scope must be explicit.
