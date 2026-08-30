import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MuxTerminal from './MuxTerminal';
import type { ExecuteResponse } from '../lib/executeTypes';

const executeCodeMock = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useMuxExecutor', () => ({
  default: () => ({ executeCode: executeCodeMock, loading: false }),
}));
vi.mock('../hooks/useApiWarmup', () => ({ default: () => undefined }));
vi.mock('../hooks/useModifierKeyLabel', () => ({ default: () => 'Ctrl' }));
vi.mock('./MonacoEditor', () => ({
  default: ({
    value,
    onChange,
    onRun,
  }: {
    value: string;
    onChange: (value: string) => void;
    onRun: () => void;
  }) =>
    React.createElement(
      React.Fragment,
      null,
      React.createElement('textarea', {
        'aria-label': 'Mux source',
        value,
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
          onChange(event.target.value),
      }),
      React.createElement(
        'button',
        { type: 'button', onClick: onRun, 'aria-label': 'Editor run' },
        'Editor run',
      ),
    ),
}));

beforeEach(() => {
  executeCodeMock.mockReset();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MuxTerminal', () => {
  it('reports empty source when the editor invokes run', async () => {
    render(<MuxTerminal initialCode="   " title="example.mux" />);

    expect(screen.getByText('example.mux')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Editor run' }));

    expect(await screen.findByText('Code snippet is empty.')).toBeInTheDocument();
    expect(executeCodeMock).not.toHaveBeenCalled();
  });

  it('renders successful compiler output', async () => {
    executeCodeMock.mockResolvedValue({ output: 'Hello from Mux!' } satisfies ExecuteResponse);
    render(<MuxTerminal initialCode={'println("Hello from Mux!")'} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    expect(await screen.findByText('Hello from Mux!')).toBeInTheDocument();
    expect(executeCodeMock).toHaveBeenCalledWith('println("Hello from Mux!")');
  });

  it('renders compiler errors and clears them on reset', async () => {
    executeCodeMock.mockResolvedValue({ error: 'Compilation failed' } satisfies ExecuteResponse);
    render(<MuxTerminal initialCode="invalid" />);

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByText('Compilation failed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(screen.queryByText('Compilation failed')).not.toBeInTheDocument());
  });

  it('copies the current source and reports the copied state', async () => {
    render(<MuxTerminal initialCode="println(1)" />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('println(1)');
  });

  it('keeps the copy action safe when the clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard unavailable'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<MuxTerminal initialCode="println(1)" />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await expect(writeText.mock.results[0]?.value).rejects.toThrow('clipboard unavailable');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    });
    expect(writeText).toHaveBeenCalledWith('println(1)');
  });
});
