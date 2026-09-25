# Skill — WaAgent Docker

Required:
- Docker threat model
- Docker collector docs

Rules:
- Engine API only through predefined collector paths;
- no arbitrary proxy;
- treat socket as privileged;
- map lifecycle events deterministically.
