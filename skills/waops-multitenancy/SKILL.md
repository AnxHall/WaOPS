# Skill — Multi-tenancy

Required:
- tenancy docs
- permission matrix
- multi-tenancy threat model

Rules:
- tenant scope explicit;
- tests with Tenant A/B;
- cache/queue/realtime/storage scoped;
- organization scope never expands tenant scope.
