export class RunStreamController {
  private current: AbortController | null = null;

  start() {
    this.current?.abort();
    const controller = new AbortController();
    this.current = controller;
    return controller;
  }

  clear(controller?: AbortController) {
    if (!controller || this.current === controller) {
      this.current = null;
    }
  }

  abort() {
    this.current?.abort();
    this.current = null;
  }
}
