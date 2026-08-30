import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlaygroundOutput from "./PlaygroundOutput";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("PlaygroundOutput", () => {
  it("shows compiler errors in preference to stale output", () => {
    render(<PlaygroundOutput value="old output" loading={false} error="Compilation failed" />);

    expect(screen.getByText("Compilation failed")).toBeInTheDocument();
    expect(screen.queryByText("old output")).not.toBeInTheDocument();
  });

  it("shows successful output when execution is complete", () => {
    render(<PlaygroundOutput value={"line one\nline two"} loading={false} error={null} />);

    expect(screen.getByText(/line one/)).toHaveTextContent("line one line two");
    expect(screen.queryByText("(no output)")).not.toBeInTheDocument();
  });

  it("shows an explicit empty state when execution has no output", () => {
    render(<PlaygroundOutput value="" loading={false} error={null} />);

    expect(screen.getByText("(no output)")).toBeInTheDocument();
  });

  it("shows the cold-start explanation only after the loading threshold", () => {
    vi.useFakeTimers();
    render(<PlaygroundOutput value="ignored" loading error={null} />);

    expect(screen.getByText("Running...")).toBeInTheDocument();
    expect(screen.queryByText(/Starting the server/)).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByText("Running...")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(
      screen.getByText(/Starting the server, this can take up to a minute/),
    ).toBeInTheDocument();
    expect(screen.queryByText("ignored")).not.toBeInTheDocument();
  });

  it("cancels the cold-start transition when loading finishes", () => {
    vi.useFakeTimers();
    const { rerender } = render(<PlaygroundOutput value="result" loading error={null} />);

    rerender(<PlaygroundOutput value="result" loading={false} error={null} />);
    act(() => vi.advanceTimersByTime(3000));

    expect(screen.getByText("result")).toBeInTheDocument();
    expect(screen.queryByText(/Starting the server/)).not.toBeInTheDocument();
  });
});
