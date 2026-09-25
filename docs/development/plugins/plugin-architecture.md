# Plugin Architecture

## Current approach

WaOPS modules are first-party and compiled/deployed by us.

Do NOT dynamically load arbitrary third-party code in the first architecture.

## Why

- security;
- tenancy;
- upgrade compatibility;
- observability;
- simpler support.

## Future

A plugin SDK may expose:
- manifest;
- capabilities;
- event subscriptions;
- API extension points;
- UI extension points;
- collector extension points.

Third-party plugin execution will require sandbox/security model before release.
