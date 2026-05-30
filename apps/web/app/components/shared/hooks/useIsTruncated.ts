import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

export type UseIsTruncatedAxis = "horizontal" | "vertical" | "both";

export type UseIsTruncatedOptions = {
  axis?: UseIsTruncatedAxis;
};

function isTruncated(element: HTMLElement, axis: UseIsTruncatedAxis): boolean {
  const horizontal = element.scrollWidth > element.clientWidth;
  const vertical = element.scrollHeight > element.clientHeight;

  if (axis === "horizontal") return horizontal;
  if (axis === "vertical") return vertical;
  return horizontal || vertical;
}

/**
 * Detects whether an element's content overflows its visible box (truncation).
 * Re-measures on mount and when the element resizes. Safe for many concurrent instances.
 */
export function useIsTruncated<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options?: UseIsTruncatedOptions,
): boolean {
  const axis = options?.axis ?? "horizontal";
  const [truncated, setTruncated] = useState(false);
  const axisRef = useRef(axis);
  axisRef.current = axis;

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element) {
      setTruncated((prev) => (prev ? false : prev));
      return;
    }

    const next = isTruncated(element, axisRef.current);
    setTruncated((prev) => (prev === next ? prev : next));
  }, [ref]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    measure();

    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [measure, axis, ref]);

  return truncated;
}
