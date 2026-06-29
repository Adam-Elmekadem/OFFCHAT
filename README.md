# OFFCHAT

**Offline Terminal Messenger** — no server, no internet, end-to-end encrypted P2P chat over LAN.

> Chat with anyone on your local network, directly from a terminal window. No accounts, no cloud, no tracking.

---

## Features

- **Offline-first** — works with zero internet. Peers discover each other automatically on the LAN via UDP broadcast.
- **E2E encrypted** — X25519 key exchange + ChaCha20-Poly1305 on every message. Forward secrecy. No plaintext, ever.
- **Terminal-native UX** — two-view TUI (peer list → chat), slash-command driven, keyboard-first.
- **Profile & status** — set a bio and status (online / away / busy), broadcast to all peers in real time.
- **Two themes** — `default` (green terminal) and `old-blue` (classic blue). Switch with `/theme`.
- **Zero dependencies to run** — single standalone `.exe` for Windows, no runtime needed.
- **Transport agnostic** — LAN now, Bluetooth and mesh relay on the roadmap.

---

## Quick Start (Windows)

1. [Download `offchat-win-x64.exe`](https://github.com/Adam-Elmekadem/OFFCHAT/releases/latest)
2. Open PowerShell or CMD in your Downloads folder
3. Run:

```
.\offchat-win-x64.exe YourName
```

> **SmartScreen warning?** Click **More info → Run anyway**. The exe is unsigned (no certificate yet).

Both machines must be on the **same Wi-Fi or Ethernet network**. Windows Firewall must allow TCP inbound on ports 1024–65535.

---

## How it works

```
offchat YourName
   │
   ├── UDP broadcast every 3 s  ──► peers discover each other
   ├── TCP connection on demand ──► encrypted chat session
   └── X25519 + ChaCha20        ──► every message encrypted end-to-end
```

1. Launch with your nickname — identity keys are generated once and stored in `~/.offchat/<nick>/`.
2. Peers on the same LAN appear in the peer list within a few seconds.
3. Type a number to open a chat with that peer. Type `Esc` to go back.

---

## Commands

| Command | What it does |
|---|---|
| `/help` | Show all commands |
| `/status <online\|away\|busy>` | Set your status (broadcast to peers in real time) |
| `/bio <text>` | Set a short bio shown in the peer list |
| `/nick <name>` | Change your display name |
| `/theme <default\|old-blue>` | Switch colour theme |
| `/online` | List discovered peers |
| `/clear` | Clear chat history |
| `/exit` | Quit |

---

## Architecture

Hexagonal / ports-and-adapters monorepo built with TypeScript + Node.js.

```
domain → protocol → security → storage → application → command-engine
                                                      ↘
                                              transport-lan
                                                      ↘
                                               terminal-ui
                                                      ↘
                                                    cli  (entry point, DI root)
```

| Package | Role |
|---|---|
| `domain` | Pure types and interfaces — zero runtime deps |
| `protocol` | msgpack serialise/deserialise of Envelope |
| `security` | X25519 + HKDF + ChaCha20-Poly1305 |
| `storage` | JSON-based local storage |
| `application` | Use-cases: SendMessage, ReceiveMessage, ConnectPeer |
| `command-engine` | CommandRegistry, slash commands, AppEvent |
| `transport-lan` | TCP server/client + UDP broadcast discovery |
| `terminal-ui` | Ink (React) TUI app |
| `cli` | Entry point — wires everything together |

---

## Build from source

```bash
# Prerequisites: Node 20+, pnpm 9+, Bun (for Windows exe only)

pnpm install
pnpm build

# Run locally (dev mode, no .exe)
node apps/cli/dist/index.js YourName
```

### Release a new Windows exe

```bash
git tag v1.x.y && git push origin v1.x.y
```

GitHub Actions builds a standalone Windows exe and publishes it to Releases automatically.

---

## Roadmap

**v1.2 (Sprint 2)**
- [x] Two-view TUI: peer list + chat
- [x] Bidirectional TCP messaging
- [x] Peer TTL (offline detection ~10 s)
- [x] Two themes: `default` and `old-blue`
- [x] System log strip in peers view
- [x] Profile: bio + status broadcast over LAN
- [ ] Contact trust flow (`/trust`, `/block`)
- [ ] Contact persistence across restarts

**v2.0 (Sprint 3)**
- [ ] Bluetooth transport (Windows BLE)
- [ ] Mesh relay — forward messages for out-of-range peers
- [ ] Message delivery ACK + retry queue
- [ ] Voice calls — `/call`, `/accept`, `/hangup` (push-to-talk over LAN UDP)
- [ ] Android APK

---

## License

MIT — see [LICENSE](LICENSE).

Built by [Adam Elmekadem](mailto:adamelmekadem61@gmail.com).
