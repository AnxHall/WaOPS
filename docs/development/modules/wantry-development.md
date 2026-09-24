# Wantry Development

## Ingestion

Dedicated project credential.
Pipeline:
1. auth project
2. payload size/rate limit
3. scrub PII
4. normalize exception
5. generate fingerprint
6. group issue
7. persist event
8. emit WaOPS event if rule matches

## Fingerprint
Default based on:
- exception type
- normalized stack frames
- application/environment

Allow custom fingerprint later.
