import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useLoadingStage from "./useLoadingStage";

afterEach(() => {
  vi.useRealTimers();
});

describe("useLoadingStage", () => {
  it("switches to the cold-start message only after the delay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ loading }) => useLoadingStage(loading), {
      initialProps: { loading: true },
    });

    expect(result.current).toBe("running");
    act(() => vi.advanceTimersByTime(2999));
    expect(result.current).toBe("running");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("cold-start");

    rerender({ loading: false });
    expect(result.current).toBe("running");
  });

  it("cancels a pending cold-start transition when loading stops", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ loading }) => useLoadingStage(loading), {
      initialProps: { loading: true },
    });

    rerender({ loading: false });
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toBe("running");
  });
});
