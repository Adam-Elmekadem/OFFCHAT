#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from '@offchat/terminal-ui';
import { buildContainer } from './container.js';
import type { AppEvent } from '@offchat/command-engine';

const args = process.argv.slice(2);
const nickname = args[0] ?? process.env['USER'] ?? process.env['USERNAME'] ?? 'anon';

let appInbound: ((e: AppEvent) => void) | null = null;

function emitToApp(event: AppEvent): void {
  if (event.type === 'exit') {
    process.exit(0);
  }
  appInbound?.(event);
}

async function main() {
  process.title = 'offchat';

  const container = await buildContainer(nickname, emitToApp);
  await container.router.startAll();

  // Events from the UI (call-initiate, call-accept, etc.) route to container.handleEvent
  const onUiEvent = (event: AppEvent): void => {
    container.handleEvent(event);
    // pass non-call events on to app (e.g. exit, system-message from commands)
    if (!event.type.startsWith('call-')) emitToApp(event);
  };

  const { unmount } = render(
    React.createElement(App, {
      nickname: container.identity.nickname,
      deviceId: container.identity.id,
      commandParser: container.commandParser,
      sendMessage: container.sendMessage,
      receiveMessage: container.receiveMessage,
      onEvent: onUiEvent,
      onReady: (inbound) => { appInbound = inbound; },
    }),
  );

  const shutdown = async () => {
    unmount();
    await container.router.stopAll();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
