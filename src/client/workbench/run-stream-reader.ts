export async function readNdjsonResponse<T>(
  response: Response,
  parseLine: (line: string) => T | null,
  onEvent: (event: T) => void,
) {
  if (!response.body) {
    return 0;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = parseLine(line);
      if (event) {
        onEvent(event);
        eventCount += 1;
      }
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const event = parseLine(buffer);
    if (event) {
      onEvent(event);
      eventCount += 1;
    }
  }

  return eventCount;
}
