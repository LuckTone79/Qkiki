"use client";

import { useCallback, useEffect, useRef } from "react";
import { RunStreamController } from "@/client/workbench/run-stream-controller";
import { readNdjsonResponse } from "@/client/workbench/run-stream-reader";

export function useRunStream() {
  const controllerRef = useRef<RunStreamController | null>(null);
  if (controllerRef.current == null) {
    controllerRef.current = new RunStreamController();
  }

  useEffect(() => {
    const controller = controllerRef.current;
    return () => controller?.abort();
  }, []);

  const startRunStream = useCallback(
    () => controllerRef.current!.start(),
    [],
  );
  const clearRunStream = useCallback(
    (controller?: AbortController) => controllerRef.current!.clear(controller),
    [],
  );
  const abortRunStream = useCallback(
    () => controllerRef.current!.abort(),
    [],
  );

  return {
    startRunStream,
    clearRunStream,
    abortRunStream,
    readNdjsonResponse,
  };
}
