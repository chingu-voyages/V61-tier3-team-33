export class FakeSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: FakeSocket[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  onclose: (() => void) | null = null
  readyState = 0
  sent: string[] = []

  constructor(public url: string) {
    FakeSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.onclose?.()
  }

  triggerOpen() {
    this.readyState = FakeSocket.OPEN
    this.onopen?.()
  }

  triggerMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }

  triggerClose() {
    this.onclose?.()
  }
}
