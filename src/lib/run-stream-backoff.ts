// Reconnect/poll delays for the run stream reader. A fixed 350ms loop hammered
// the status endpoint (and through it the database) for the whole duration of
// a run whenever the stream dropped; back off while the run is still working
// and reset as soon as fresh events arrive.
const RUN_STREAM_BASE_DELAY_MS = 350;
const RUN_STREAM_MAX_DELAY_MS = 2000;

export function getRunStreamRetryDelayMs(attempt: number) {
  const exponent = Math.max(0, attempt);
  return Math.min(
    RUN_STREAM_BASE_DELAY_MS * 2 ** exponent,
    RUN_STREAM_MAX_DELAY_MS,
  );
}
