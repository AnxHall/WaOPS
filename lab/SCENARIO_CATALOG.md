# Lab Scenario Catalog

## LAB-HTTP-001
HTTP endpoint returns 500 continuously.
Expected:
- monitor.http.failed
- incident after policy
- recovery after consecutive successes

## LAB-HTTP-002
Endpoint alternates 200/500.
Expected:
- flapping detection
- notification suppression according to policy

## LAB-DOCKER-001
Container exits unexpectedly.
Expected:
- container.down
- incident
- recovery on restart

## LAB-POSTGRES-001
Connection pool approaches max.
Expected:
- postgres connections metrics
- database.connections.high after duration

## LAB-POSTGRES-002
Lock wait/deadlock.
Expected:
- lock/deadlock signal
- incident context

## LAB-NET-001
Inject latency with proxy.
Expected:
- latency metric increase
- threshold event only after configured duration
