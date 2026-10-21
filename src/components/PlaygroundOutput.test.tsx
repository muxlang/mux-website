import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PlaygroundOutput from './PlaygroundOutput';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PlaygroundOutput', () => {
  it('shows compiler errors in preference to stale output', () => {
    render(<PlaygroundOutput value="old output" loading={false} error="Compilation failed" />);

    expect(screen.getByText('Compilation failed')).toBeInTheDocument();
    expect(screen.queryByText('old output')).not.toBeInTheDocument();
  });

  it('shows successful output when execution is complete', () => {
    render(<PlaygroundOutput value={'line one\nline two'} loading={false} error={null} />);

    expect(screen.getByText(/line one/)).toHaveTextContent('line one line two');
    expect(screen.queryByText('(no output)')).not.toBeInTheDocument();
  });

  it('shows an explicit empty state when execution has no output', () => {
    render(<PlaygroundOutput value="" loading={false} error={null} />);

    expect(screen.getByText('(no output)')).toBeInTheDocument();
  });

  it('shows and resets the cold-start explanation across loading requests', () => {
    vi.useFakeTimers();
    const { rerender } = render(<PlaygroundOutput value="ignored" loading error={null} />);

    expect(screen.getByText('Running...')).toBeInTheDocument();
    expect(screen.queryByText(/Starting the server/)).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText('Running...')).toBeInTheDocument();
    rerender(<PlaygroundOutput value="result" loading={false} error={null} />);
    expect(screen.getByText('result')).toBeInTheDocument();
    expect(screen.queryByText(/Starting the server/)).not.toBeInTheDocument();

    rerender(<PlaygroundOutput value="next request" loading error={null} />);
    expect(screen.getByText('Running...')).toBeInTheDocument();
    expect(screen.queryByText(/Starting the server/)).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('Running...')).toBeInTheDocument();
    expect(screen.queryByText(/Starting the server/)).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText(/Starting the server, this can take up to a minute/)).toBeInTheDocument();
    expect(screen.queryByText('next request')).not.toBeInTheDocument();

    rerender(<PlaygroundOutput value="finished early" loading={false} error={null} />);
    expect(screen.getByText('finished early')).toBeInTheDocument();

    rerender(<PlaygroundOutput value="short request" loading error={null} />);
    act(() => vi.advanceTimersByTime(1000));
    rerender(<PlaygroundOutput value="completed quickly" loading={false} error={null} />);
    act(() => vi.advanceTimersByTime(3000));

    expect(screen.getByText('completed quickly')).toBeInTheDocument();
    expect(screen.queryByText(/Starting the server/)).not.toBeInTheDocument();
  });
});
