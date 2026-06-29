# OFFCHAT — User Guide

**OFFCHAT** is an offline terminal messenger. It lets you chat with people on the same Wi-Fi or Ethernet network, directly from a terminal window — no internet, no server, no account required. Every message is end-to-end encrypted automatically.

---

## Table of Contents

1. [Installation](#1-installation)
2. [First Launch](#2-first-launch)
3. [The Interface](#3-the-interface)
4. [Finding Peers](#4-finding-peers)
5. [Chatting](#5-chatting)
6. [Profile — Bio & Status](#6-profile--bio--status)
7. [Themes](#7-themes)
8. [All Commands](#8-all-commands)
9. [Encryption](#9-encryption)
10. [Troubleshooting](#10-troubleshooting)
11. [Known Limitations](#11-known-limitations)

---

## 1. Installation

### Windows (recommended)

1. Go to [github.com/Adam-Elmekadem/OFFCHAT/releases](https://github.com/Adam-Elmekadem/OFFCHAT/releases)
2. Download `offchat-win-x64.exe` from the latest release
3. Move it anywhere you like (e.g. `C:\Tools\offchat.exe`)
4. Open **PowerShell** or **CMD** and run it with your name

```powershell
.\offchat-win-x64.exe YourName
```

> **Windows SmartScreen warning?**
> The app is unsigned (no certificate yet). Click **More info → Run anyway**.
> It only appears on first run.

> **Browser warning when downloading?**
> Chrome: click ⋮ next to the warning → **Keep** → **Keep anyway**
> Edge: click **...** → **Keep** → **Show more** → **Keep anyway**

---

## 2. First Launch

```
offchat-win-x64.exe Adam
```

Replace `Adam` with any nickname you want (letters, numbers, spaces allowed).

**What happens on first launch:**
- A unique identity keypair is generated and saved to `%USERPROFILE%\.offchat\adam\`
- A default profile is created: `status = online`, `bio = (empty)`
- The app starts scanning the local network for other OFFCHAT users
- Your identity is permanent — same keys every time you launch with the same nickname

---

## 3. The Interface

OFFCHAT has two views that you switch between:

### Peers View (default)

```
 OFFCHAT │ Adam │ 2 peers │ LAN
────────────────────────────────────────────
 ● Peers nearby

 [1]  ● bob            lan
      backend dev, always building
 [2]  ◐ alice          lan

 type a number to chat  ·  /help for commands
────────────────────────────────────────────
 [20:41] OFFCHAT started. Type /help for commands.
 [20:43] peer found: bob — press [1] to chat
──────────────────────────────────
 number or /command >
```

| Element | What it means |
|---|---|
| Status bar (top) | Your nickname, peer count, transport |
| Peer list | All peers found on the network, with status dots |
| System log (bottom strip) | Recent events and command output |
| Input bar | Where you type commands or numbers |

### Chat View

```
 OFFCHAT │ Adam → bob │ LAN
────────────────────────────────────────────
 [20:41] you: hey, got the files?
 [20:41] bob: yeah just got them. encrypted?
 [20:42] you: always 🔐
────────────────────────────────────────────
 bob > _
```

---

## 4. Finding Peers

**OFFCHAT finds peers automatically** — you don't need to enter any IP address.

Both machines must be on the **same Wi-Fi or Ethernet network**. The app broadcasts its presence every 3 seconds over UDP. New peers appear in the list within a few seconds of them launching OFFCHAT.

**Status dots** show what each peer is doing:

| Dot | Color | Meaning |
|---|---|---|
| `●` | Green | Online — active and available |
| `◐` | Yellow | Away — stepped away |
| `◉` | Red | Busy — do not disturb |
| `○` | Gray | Offline — disconnected or quit |

A peer goes offline automatically **~10 seconds** after they quit the app (3 missed broadcasts).

**Two devices on the same physical machine?** FileDiscovery handles that automatically via `%USERPROFILE%\.offchat\peers\` — no network needed.

---

## 5. Chatting

### Open a chat

In the Peers View, type the number next to a peer and press Enter:

```
> 1
```

This opens the Chat View with that peer. The connection is TCP, encrypted end-to-end from the first byte.

### Send a message

Just type and press Enter:

```
bob > hey, are you there?
```

### Go back to the peer list

Press **Esc** — or type `/back`.

### Switch to a different peer

While in any chat, just type the peer number:

```
> 2
```

This switches to peer #2 without going back to the list first.

### Unread messages

When a peer sends you a message while you're chatting with someone else, their row in the peer list shows:

```
[1]  ● bob            lan   +3 new
```

The count clears when you open that chat.

---

## 6. Profile — Bio & Status

Your **profile** is stored locally in `%USERPROFILE%\.offchat\<yournick>\profile.json`.
It has two fields: **status** and **bio**. Both are broadcast to all peers on the network every 3 seconds, so changes appear on other screens almost instantly.

### Status

Your availability, shown as a colored dot next to your name in everyone's peer list.

```
/status online
/status away
/status busy
```

| Status | Dot | Meaning |
|---|---|---|
| `online` | ● green | You're here and active |
| `away` | ◐ yellow | Stepped away — back soon |
| `busy` | ◉ red | Do not disturb |

**Example:**
```
> /status away
status set to "away"
```
Within 3 seconds, every peer on the network sees your dot turn yellow.

Your status is saved to `profile.json` and restored the next time you launch.

---

### Bio

A short description (max 60 characters) shown under your name in the peer list.

```
/bio <text>
```

**Examples:**
```
> /bio software engineer, coffee addict
> /bio on a call until 3pm
> /bio       ← leave empty to clear your bio
```

Your bio appears under your name in everyone's peer list:

```
[1]  ● adam            lan
     software engineer, coffee addict
```

Bio is also saved to `profile.json` and restored on next launch.

---

## 7. Themes

OFFCHAT comes with two colour themes. Switch with `/theme`:

```
/theme default
/theme old-blue
```

| Theme | Description |
|---|---|
| `default` | Dark background, green accents — classic hacker terminal |
| `old-blue` | Blue background, white text, yellow accents — retro CRT style |

The theme takes effect immediately. It is **not** saved between sessions (add `/theme old-blue` to your startup if you prefer it).

**See available themes:**
```
> /theme
themes: default, old-blue  — current: default
```

---

## 8. All Commands

Type any command in the input bar, from any view. Output appears in the system log.

### Navigation

| Command | What it does |
|---|---|
| `1`, `2`, `3`… | Open chat with peer #N |
| `Esc` | Go back to the peer list |
| `/back` | Same as Esc |

### Profile

| Command | What it does |
|---|---|
| `/status <online\|away\|busy>` | Set your status, broadcast to all peers |
| `/bio <text>` | Set your bio (max 60 chars, leave empty to clear) |

### Identity

| Command | What it does |
|---|---|
| `/nick <name>` | Change your display nickname for this session |

### Network

| Command | What it does |
|---|---|
| `/online` | List all currently discovered peers with their device IDs |
| `/connect <deviceId>` | Manually connect to a peer by device ID |

### Chat

| Command | What it does |
|---|---|
| `/history` | Show recent message history for the current chat |
| `/clear` | Clear the chat window |

### Appearance

| Command | What it does |
|---|---|
| `/theme <name>` | Switch colour theme (`default` or `old-blue`) |
| `/theme` | Show available themes and current theme |

### General

| Command | What it does |
|---|---|
| `/help` | List all commands with descriptions |
| `/exit` | Quit OFFCHAT |

---

## 9. Encryption

Every message is encrypted automatically. You don't configure anything.

**How it works:**

1. When you first launch, OFFCHAT generates a unique **X25519 keypair** and saves it locally
2. Your public key is broadcast with every UDP discovery packet
3. When you send a message, OFFCHAT performs an ephemeral **X25519 key exchange** with the recipient
4. The shared secret is expanded with **HKDF** into a session key
5. The message is encrypted with **ChaCha20-Poly1305** (authenticated encryption)
6. The recipient decrypts with their private key — no one else can read it

**What this means:**
- No server ever sees your messages
- Even if your network traffic is recorded, messages are unreadable
- Each message uses a fresh ephemeral key (forward secrecy)
- Messages older than 5 minutes are rejected (clock skew protection)

---

## 10. Troubleshooting

### Peers don't appear

- Make sure both machines are on the **same Wi-Fi or Ethernet** — two different Wi-Fi networks (even in the same building) won't work
- Windows Firewall must allow TCP inbound on ports 1024–65535
  - Go to: *Windows Security → Firewall → Advanced Settings → Inbound Rules → New Rule → Port → TCP → 1024-65535 → Allow*
- Try running both apps as the same Windows user
- Wait up to 10 seconds — discovery broadcasts every 3 s

### "Clock skew exceeded" error

Your system clocks differ by more than 5 minutes. Fix the time on both machines:
```powershell
w32tm /resync
```

### "Send failed: u coordinate of length 32 expected, got 0"

The peer was found before their public key was received. Wait a few seconds and try again — the next broadcast will include their key.

### Messages send but replies don't appear

Rare TCP routing issue. Press Esc, then re-open the chat — this triggers a fresh connection.

### SmartScreen blocks the exe every time

This happens if the exe is on a network drive or a path Windows doesn't trust. Move it to `C:\Tools\` or your Desktop.

---

## 11. Known Limitations

| Limitation | Status |
|---|---|
| Messages lost on exit | No persistence yet — planned for Sprint 2 Week 3 |
| Contacts lost on restart | Peers re-discovered automatically each session |
| LAN only | Bluetooth and mesh relay on the roadmap |
| Windows only | macOS and Linux builds planned |
| Unsigned exe | SmartScreen warns on first run — click More info → Run anyway |
| No read receipts | ACK + retry queue planned for Sprint 3 |
| Max bio length | 60 characters |
| Clock skew > 5 min | Causes "envelope invalid" — sync your system clock |

---

## File Locations

| Path | What's stored |
|---|---|
| `%USERPROFILE%\.offchat\<nick>\offchat-storage.json` | Identity keys (device ID, keypair) |
| `%USERPROFILE%\.offchat\<nick>\profile.json` | Your bio and status |
| `%USERPROFILE%\.offchat\peers\` | FileDiscovery peer files (same-machine discovery) |

> Your private key never leaves your machine. Delete the folder to start fresh with a new identity.

---

## Roadmap

**Coming next (Sprint 2 Week 3):**
- Contact trust — explicit `/trust` before chatting with someone
- Contact list persists across restarts
- `/block <id>` command

**Sprint 3:**
- Bluetooth transport
- Mesh relay (chat with peers out of direct Wi-Fi range)
- Message delivery ACKs + retry queue
- **Voice calls** — `/call <n>`, `/accept`, `/hangup`, push-to-talk over LAN
- Android APK

---

*Built by [Adam Elmekadem](mailto:adamelmekadem61@gmail.com) · MIT License · No server · No tracking*
