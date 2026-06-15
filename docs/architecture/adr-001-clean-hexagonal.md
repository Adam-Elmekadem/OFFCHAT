# ADR-001: Clean Hexagonal Architecture

**Status:** Accepted  
**Date:** 2026-06-15

## Context

OFFCHAT must support multiple transports (LAN, Bluetooth, Mesh) from day one. Mixing business logic with transport code creates fragile coupling that makes adding transports expensive and testing unreliable.

## Decision

Adopt Clean Architecture + Hexagonal (Ports and Adapters):

- **Domain** (`@offchat/domain`) — pure TypeScript entities and port interfaces. Zero runtime dependencies. Never imports from infrastructure.
- **Application** (`@offchat/application`) — use cases and orchestration. Depends only on domain ports, never on concrete adapters.
- **Infrastructure** (`@offchat/storage`, `@offchat/transport-lan`, `@offchat/security`) — implements domain ports. Can use any library.
- **Interface** (`@offchat/terminal-ui`, `@offchat/command-engine`) — drives the application layer. Has no business logic.

The dependency rule: arrows point inward only. Domain knows nothing about infrastructure.

## Consequences

- Adding a new transport requires only implementing `ITransport` and registering it in the CLI container.
- All use cases are testable with `FakeTransport` and an in-memory storage stub.
- Protocol changes are isolated to `@offchat/protocol`; no domain entity changes needed.
