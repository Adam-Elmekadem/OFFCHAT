# OFFCHAT

Offline Terminal Messenger

OFFCHAT is a terminal-inspired messenger designed to work without Internet by using local and peer-to-peer transports such as LAN, Bluetooth, Wi-Fi Direct, and mesh relays.

## 1) Product Vision

Allow people to communicate anywhere, even without Internet, through a lightweight terminal-style messenger.

## 2) Core Product Principles

- Offline first: no Internet is required for core messaging.
- Terminal native UX: fast keyboard workflow and command-driven controls.
- Transport agnostic: one chat domain model, many transport adapters.
- Security by default: encrypted sessions and peer verification.
- Resilient networking: reconnect, retry, failover, and mesh relay.
- Local ownership: history and identity remain on device.

## 3) Recommended Architecture

Use Clean Architecture + Hexagonal (Ports and Adapters):

- Domain layer: chat entities, commands, policies, encryption contracts.
- Application layer: use-cases, orchestration, routing, transport selection.
- Infrastructure layer: LAN, Bluetooth, Wi-Fi Direct, mesh, local storage.
- Interface layer: terminal UI, command parser, notifications.

Why this architecture?

- Keeps business logic independent from network technology.
- Lets you add new transports without rewriting core logic.
- Makes testing easier with mock ports and contract tests.

## 4) Proposed High-Level Modules

- core-domain
  - Identity, Message, Room, Contact, Session, Device, Transport types.
- app-services
  - SendMessage, ReceiveMessage, ConnectPeer, JoinRoom, EncryptMessage.
- transport-lan
  - TCP server/client, discovery, reconnect.
- transport-bluetooth
  - BLE/Classic discovery, pairing, connection lifecycle.
- transport-wifidirect
  - peer discovery, group create/join, quality monitoring.
- transport-mesh
  - relay, multi-hop routing, loop prevention, route TTL.
- storage
  - local DB, message history, contact store, settings.
- security
  - key generation, session keys, identity verification, key rotation.
- terminal-ui
  - renderer, prompt, command input, status bar, theming.
- command-engine
  - slash command parser and executor.
- notifications
  - mention alerts, sounds, DND.
- file-transfer
  - chunking, integrity checks, resume/cancel.
- packaging
  - desktop and Android distribution artifacts.

## 5) Recommended Repository Structure

Use a monorepo for shared protocol/domain code across platforms.

```text
offchat/
  README.md
  LICENSE
  .gitignore
  .editorconfig
  .gitattributes
  docs/
    architecture/
      adr-001-clean-hexagonal.md
      c4-context.md
      c4-container.md
    product/
      roadmap.md
      epics.md
      sprint-plan.md
    security/
      threat-model.md
      key-management.md
    protocol/
      message-schema.md
      transport-contracts.md
  apps/
    cli/                 # Terminal app (desktop)
    android/             # Android client (future)
  packages/
    domain/              # Pure domain model and policies
    application/         # Use-cases and orchestration
    protocol/            # Message schema and serialization
    transport-lan/
    transport-bluetooth/
    transport-wifidirect/
    transport-mesh/
    storage/
    security/
    command-engine/
    terminal-ui/
    notifications/
    file-transfer/
    testkit/             # Shared test fixtures and fake transports
  scripts/
    dev/
    ci/
  tests/
    e2e/
    integration/
```

## 6) Communication and Data Model

Define one canonical envelope for every transport:

- envelope_id: globally unique ID (UUIDv7 preferred)
- timestamp_utc: sender timestamp
- sender_device_id
- sender_nickname
- chat_scope: dm | room
- room_id (nullable)
- message_type: text | file_meta | command_event | system
- payload
- ttl_hops (for mesh)
- signature
- encryption_metadata

Best practice:

- Keep transport payload binary-safe and versioned.
- Include protocol_version in every envelope.
- Validate and reject invalid envelopes early.

## 7) Smart Transport Engine Design

Transport priority (default):

1. Wi-Fi Direct
2. Bluetooth
3. Mesh Relay
4. LAN (same network fallback if available)

Selection strategy:

- Detect available transports continuously.
- Score each transport using latency, bandwidth, stability, battery cost.
- Select best transport per peer/session.
- Fail over automatically on degradation.
- Keep a short warm standby connection for faster switching.

## 8) Suggested Command Set (MVP to v1)

MVP:

- /help
- /nick <name>
- /online
- /connect <peer>
- /disconnect
- /history
- /clear
- /exit

v1 extended:

- /join <room>
- /leave <room>
- /rooms
- /send <file>
- /ping
- /me <action>
- /dnd on|off

## 9) Security Baseline (Must-Have)

- Use authenticated encryption (for example AES-GCM or ChaCha20-Poly1305).
- Perform key exchange with forward secrecy.
- Pin device identity keys for known contacts.
- Show trust state in terminal UI (trusted/unverified).
- Rotate session keys on reconnect or after message thresholds.
- Never store plaintext private keys.
- Encrypt local message history at rest.

## 10) Reliability Requirements

- At-least-once delivery for normal messages (with dedup).
- Message deduplication by envelope_id.
- ACK with retry and backoff.
- Graceful reconnect and session resumption.
- Offline queue with expiration policy.
- Clock skew tolerance in ordering logic.

## 11) Database and Storage Best Practices

- Keep append-only message log + indexed query tables.
- Store contacts, peers, rooms, device trust graph.
- Use migrations from day one.
- Add encryption-at-rest abstraction, not ad-hoc per table.
- Add periodic compaction and retention policy.

## 12) Development Best Practices

- Start with architecture decision records (ADRs).
- Use conventional commits and semantic versioning.
- Enforce lint, formatting, and type checks in CI.
- Prefer contract tests between application layer and transport adapters.
- Create fake transport adapters for deterministic tests.
- Add chaos tests for disconnects and packet loss.
- Document every protocol change with version notes.

## 13) Testing Strategy

- Unit tests: domain rules, command parser, routing policies.
- Integration tests: real transport adapters against test peers.
- E2E tests: two or more clients exchanging messages and files.
- Security tests: replay resistance, tamper detection, key rotation.
- Performance tests: latency and throughput under weak links.

Definition of Done for network features:

- Works under packet loss and intermittent disconnects.
- Has telemetry/logging for diagnosis.
- Includes retry/failover tests.
- Includes docs and runbook updates.

## 14) Observability and Debugging

- Structured logs with correlation IDs (envelope_id).
- Transport-level metrics: RTT, reconnect count, send failures.
- Command to inspect network state: /netstat
- Command to dump diagnostics safely: /diag export

## 15) Product Roadmap to Architecture Mapping

Phase 1 (LAN MVP):

- Build domain + application + terminal UI + transport-lan.
- Deliver direct DM and basic command set.

Phase 2 (Bluetooth):

- Add transport-bluetooth adapter.
- Keep same domain/application APIs.

Phase 3 (Wi-Fi Direct):

- Add transport-wifidirect + quality scoring hooks.

Phase 4 (Mesh):

- Add transport-mesh + route table + TTL + dedup.

Phase 5 (Offline Discord):

- Add rooms, permissions, presence, moderation features.

## 16) Suggested Sprint Execution

Sprint 1 (2 weeks):

- Epic 1 Terminal Experience
- Epic 2 User Identity
- Epic 3 LAN Messaging

Sprint 2:

- Epic 7 Terminal Commands
- Epic 10 Message History
- Epic 11 Notifications

Sprint 3:

- Epic 4 Bluetooth Messaging
- Epic 6 Contacts

Sprint 4:

- Epic 5 Wi-Fi Direct
- Epic 9 File Sharing

Sprint 5:

- Epic 12 Encryption
- Epic 8 Chat Rooms

Sprint 6:

- Epic 13 Mesh Networking
- Epic 15 Smart Transport Engine

Sprint 7:

- Epic 14 Offline Discord
- Epic 16 Fun Terminal Features
- Epic 17 Packaging and Distribution

## 17) Immediate Next Steps (Practical)

1. Finalize tech stack (language/runtime for CLI and Android).
2. Create monorepo skeleton from the structure above.
3. Implement protocol envelope and command parser first.
4. Build LAN adapter with reconnect + ACK + dedup.
5. Add local history storage and identity management.
6. Add encryption layer before adding file transfer.

## 18) Suggested Engineering Standards

- Branch model: trunk-based with short-lived feature branches.
- CI gates: lint, typecheck, unit tests, integration smoke tests.
- Security gate: dependency scanning and secret scanning.
- Release process: changelog + tagged releases per sprint.
- Documentation rule: no feature merged without docs update.

## 19) License and Contribution

Recommended:

- License: MIT or Apache-2.0.
- Add CONTRIBUTING.md with coding standards and test requirements.
- Add CODE_OF_CONDUCT.md for community readiness.

---

If you want, the next step can be generating the full monorepo folder skeleton and starter files for Sprint 1 automatically.
