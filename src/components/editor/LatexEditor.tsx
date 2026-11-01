"use client";

import { t } from "@/lib/i18n";
import { autocompletion } from "@codemirror/autocomplete";
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { Prec } from "@codemirror/state";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { tags } from "@lezer/highlight";
import CodeMirror, { type EditorView } from "@uiw/react-codemirror";
import { latexCompletions } from "@/components/editor/latexCompletions";

const latexColors = HighlightStyle.define([
  { tag: tags.tagName, color: "#e5c07b" },
  { tag: [tags.keyword, tags.atom], color: "#98c379" },
  { tag: tags.bracket, color: "#c678dd" },
  { tag: tags.number, color: "#d19a66" },
  { tag: tags.string, color: "#56b6c2" },
  { tag: tags.comment, color: "#7f848e", fontStyle: "italic" },
]);

const extensions = [
  StreamLanguage.define(stex),
  Prec.highest(syntaxHighlighting(latexColors)),
  autocompletion({ override: [latexCompletions] }),
];

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
