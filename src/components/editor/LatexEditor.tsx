"use client";

import { t } from "@/lib/i18n";
import { autocompletion } from "@codemirror/autocomplete";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import CodeMirror, { type EditorView } from "@uiw/react-codemirror";
import { latexCompletions } from "@/components/editor/latexCompletions";

const extensions = [StreamLanguage.define(stex), autocompletion({ override: [latexCompletions] })];

interface LatexEditorProps {
  value: string;
  onChange: (value: string) => void;
  onReady: (view: EditorView) => void;
  fontSize: number;
}

export default function LatexEditor({ value, onChange, onReady, fontSize }: LatexEditorProps) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onCreateEditor={onReady}
      extensions={extensions}
      theme="dark"
      height="100%"
      className="h-full"
      style={{ fontSize }}
      basicSetup={{ lineNumbers: true, indentOnInput: true, autocompletion: false }}
      aria-label={t("sourceLabel")}
    />
  );
}
