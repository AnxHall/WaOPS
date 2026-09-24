# WaAgent Protocol v1

Status: DRAFT

## Design goals

- outbound-first;
- versioned;
- resumable;
- bounded;
- secure;
- compatible across agent/cloud upgrades.

## Surfaces

### Enrollment
Agent exchanges short-lived enrollment token for durable identity.

### Heartbeat
Lightweight agent health/capability signal.

### Inventory
Host, interfaces, filesystems, containers and discovered resources.

### Metrics batch
Numeric time-series.

### Events
Discrete operational facts.

### Configuration
Cloud returns enabled capabilities, intervals and safe collector config.

### Upgrade metadata
Cloud informs available signed version.

## Connection model

WaAgent initiates HTTPS connections to WaOPS.

No inbound agent listener is required for phase 1.

## Version compatibility

Cloud maintains:
- minimum supported protocol;
- maximum supported protocol;
- minimum recommended agent version.

Agent must fail safely if protocol is unsupported.

## Sequence

Metric/event batches may include monotonic sequence per agent stream.

Server acknowledgement allows local buffer deletion.

## Backpressure

Server may return:
- retry-after;
- rate limit;
- payload-too-large;
- unsupported-version.

Agent must not busy-loop.

## Credentials

Tenant scope is derived from authenticated agent identity, never trusted from arbitrary payload field.
