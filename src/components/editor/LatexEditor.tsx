"use client";

import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import CodeMirror, { type EditorView } from "@uiw/react-codemirror";

const extensions = [StreamLanguage.define(stex)];

interface LatexEditorProps {
  value: string;
  onChange: (value: string) => void;
  onReady: (view: EditorView) => void;
}

export default function LatexEditor({ value, onChange, onReady }: LatexEditorProps) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onCreateEditor={onReady}
      extensions={extensions}
      theme="dark"
      height="100%"
      className="h-full text-sm"
      basicSetup={{ lineNumbers: true, indentOnInput: true }}
      aria-label="LaTeX-Quelltext"
    />
  );
}
