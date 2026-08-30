import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MonacoEditorComponent from './index';

const monacoEditorMock = vi.hoisted(() => ({
  props: undefined as Record<string, unknown> | undefined,
}));
const registerMuxLanguageMock = vi.hoisted(() => vi.fn());

vi.mock('@monaco-editor/react', () => ({
  default: (props: Record<string, unknown>) => {
    monacoEditorMock.props = props;
    return React.createElement('div', { 'data-testid': 'monaco-editor' });
  },
}));

vi.mock('@site/src/monaco/muxLanguage', () => ({
  registerMuxLanguage: registerMuxLanguageMock,
}));

interface EditorModel {
  getLineCount: () => number;
}

interface Editor {
  getModel: () => EditorModel;
  onDidChangeModelContent: (listener: () => void) => { dispose: () => void };
  addAction: (action: { run: () => void }) => void;
}

interface MonacoMock {
  KeyMod: { CtrlCmd: number };
  KeyCode: { Enter: number };
}

const createEditor = (lineCount: number) => {
  let currentLineCount = lineCount;
  let contentListener = () => undefined;
  const editor: Editor = {
    getModel: () => ({ getLineCount: () => currentLineCount }),
    onDidChangeModelContent: (listener) => {
      contentListener = listener;
      return { dispose: vi.fn() };
    },
    addAction: vi.fn(),
  };
  return {
    editor,
    notifyContentChanged: (nextLineCount: number) => {
      currentLineCount = nextLineCount;
      contentListener();
    },
  };
};

beforeEach(() => {
  monacoEditorMock.props = undefined;
  registerMuxLanguageMock.mockReset();
  document.body.className = '';
  document.documentElement.dataset.theme = 'light';
});

afterEach(() => {
  cleanup();
  document.body.className = '';
  delete document.documentElement.dataset.theme;
});

describe('MonacoEditorComponent', () => {
  it('registers the language, sizes from content, and forwards editor actions', async () => {
    const onChange = vi.fn();
    const firstRun = vi.fn();
    const secondRun = vi.fn();
    const { editor, notifyContentChanged } = createEditor(12);
    const monaco: MonacoMock = {
      KeyMod: { CtrlCmd: 1 },
      KeyCode: { Enter: 2 },
    };

    const { rerender } = render(
      <MonacoEditorComponent value="func main()" onChange={onChange} onRun={firstRun} />,
    );
    const props = monacoEditorMock.props;
    if (!props) {
      throw new Error('Monaco editor props were not captured');
    }

      (props.beforeMount as (instance: MonacoMock) => void)(monaco);
    expect(registerMuxLanguageMock).toHaveBeenCalledWith(monaco);

    await act(async () => {
      (props.onMount as (instance: Editor, monaco: MonacoMock) => void)(editor, monaco);
    });
    expect(editor.addAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'run-mux',
        keybindings: [3],
      }),
    );
    expect(monacoEditorMock.props?.height).toBe('276px');

    const action = (editor.addAction as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      run: () => void;
    };
    action.run();
    expect(firstRun).toHaveBeenCalledOnce();

    rerender(<MonacoEditorComponent value="updated" onChange={onChange} onRun={secondRun} />);
    action.run();
    expect(secondRun).toHaveBeenCalledOnce();

    await act(async () => {
      notifyContentChanged(4);
    });
    expect(monacoEditorMock.props?.height).toBe('150px');
    (monacoEditorMock.props?.onChange as (value?: string) => void)(undefined);
    (monacoEditorMock.props?.onChange as (value?: string) => void)('next');
    expect(onChange).toHaveBeenNthCalledWith(1, '');
    expect(onChange).toHaveBeenNthCalledWith(2, 'next');
  });

  it('updates the editor theme when the document theme changes', async () => {
    const { editor } = createEditor(1);
    const monaco: MonacoMock = { KeyMod: { CtrlCmd: 1 }, KeyCode: { Enter: 2 } };
    render(<MonacoEditorComponent value="" onChange={vi.fn()} />);
    const props = monacoEditorMock.props;
    if (!props) {
      throw new Error('Monaco editor props were not captured');
    }

    await act(async () => {
      (props.onMount as (instance: Editor, monaco: MonacoMock) => void)(editor, monaco);
    });
    expect(monacoEditorMock.props?.theme).toBe('vs');

    document.documentElement.dataset.theme = 'dark';
    await waitFor(() => expect(monacoEditorMock.props?.theme).toBe('vs-dark'));
  });

  it('uses the container height when fill sizing is requested', () => {
    render(<MonacoEditorComponent value="" onChange={vi.fn()} sizing="fill" />);

    expect(monacoEditorMock.props?.height).toBe('100%');
    expect(monacoEditorMock.props?.options).toEqual(
      expect.objectContaining({ automaticLayout: true, fontLigatures: false }),
    );
  });
});
