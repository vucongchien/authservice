import { EventEmitter } from "node:events";

export interface MagicLinkEvent {
  email: string;
  token: string;
  url: string;
  expiresAt: Date;
}

export interface AppEvents {
  "auth.email.magic_link": (event: MagicLinkEvent) => void;
}

class TypedEventBus extends EventEmitter {
  emitEvent<K extends keyof AppEvents>(event: K, ...args: Parameters<AppEvents[K]>): boolean {
    return super.emit(event, ...args);
  }

  onEvent<K extends keyof AppEvents>(event: K, listener: AppEvents[K]): this {
    return super.on(event, listener as (...args: any[]) => void);
  }
}

export const eventBus = new TypedEventBus();
