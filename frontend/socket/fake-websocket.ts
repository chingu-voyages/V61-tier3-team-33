/**
 * Minimal controllable WebSocket double for tests. Doesn't open a real
 * connection — tests trigger open/message/close manually to drive
 * SocketClient's reconnect logic deterministically.
 */
export class FakeWebSocket {
  static OPEN = 1
  static CONNECTING = 0
  static CLOSED = 3

  static instances: FakeWebSocket[] = []

  readyState = FakeWebSocket.CONNECTING
  sent: string[] = []

  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: (() => void) | null = null

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED
  }

  // --- test-only helpers, not part of the real WebSocket API ---

  triggerOpen(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  triggerMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }

  triggerClose(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }

  static reset(): void {
    FakeWebSocket.instances = []
  }

  static latest(): FakeWebSocket {
    const ws = FakeWebSocket.instances.at(-1)
    if (!ws) throw new Error("no FakeWebSocket instance created yet")
    return ws
  }
}
