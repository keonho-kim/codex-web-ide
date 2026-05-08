import { nanoid } from "nanoid";
import type { Envelope, SessionEvent } from "../shared/types";

type Listener = (event: Envelope) => void;

export class EventBus {
  private listeners = new Map<string, Set<Listener>>();
  private buffers = new Map<string, Envelope[]>();

  subscribe(sessionId: string, listener: Listener) {
    const set = this.listeners.get(sessionId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(sessionId, set);
    for (const event of this.buffers.get(sessionId) ?? []) listener(event);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(sessionId);
    };
  }

  publish(sessionId: string, event: SessionEvent) {
    const envelope: Envelope = {
      ...event,
      id: nanoid(),
      sessionId,
      timestamp: Date.now(),
    };
    const buffer = this.buffers.get(sessionId) ?? [];
    buffer.push(envelope);
    this.buffers.set(sessionId, buffer.slice(-300));
    for (const listener of this.listeners.get(sessionId) ?? []) listener(envelope);
    return envelope;
  }
}
