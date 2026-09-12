import { useEffect, useRef, useState } from "react";
import { cleanProcessReader, processReaderKey } from "./reader.mjs";
export function useProcessReader(modelId, ready) {
  const key = processReaderKey(modelId);
  const [reader, setReader] = useState(() => {
    try {
      return cleanProcessReader(JSON.parse(localStorage.getItem(key) || "{}"));
    } catch {
      return cleanProcessReader();
    }
  });
  const [error, setError] = useState("");
  const latest = useRef(reader);
  latest.current = reader;
  const save = () =>
    localStorage.setItem(
      key,
      JSON.stringify(cleanProcessReader(latest.current)),
    );
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      try {
        save();
        setError("");
      } catch {
        setError("视图偏好无法保存；模型内容未受影响。");
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [key, ready, reader]);
  useEffect(() => {
    const persist = () => {
      if (ready)
        try {
          save();
        } catch {
          /* The in-session error is displayed above. */
        }
    };
    window.addEventListener("beforeunload", persist);
    return () => {
      window.removeEventListener("beforeunload", persist);
      persist();
    };
  }, [key, ready]);
  return { reader, setReader, error };
}
