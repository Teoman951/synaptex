import { type Completion, type CompletionContext, snippetCompletion } from "@codemirror/autocomplete";

const COMMANDS = [
  "alpha", "author", "begin", "beta", "bibliography", "bibliographystyle", "bigskip", "caption",
  "centering", "chapter", "cite", "clearpage", "date", "delta", "documentclass", "emph", "end",
  "epsilon", "footnote", "frac", "gamma", "hline", "href", "hspace", "include", "includegraphics",
  "input", "infty", "int", "item", "label", "lambda", "ldots", "left", "maketitle", "medskip",
  "mu", "newcommand", "newpage", "noindent", "omega", "paragraph", "parencite", "phi", "pi",
  "qquad", "quad", "ref", "renewcommand", "right", "section", "sigma", "smallskip", "sqrt", "sum",
  "tableofcontents", "textbf", "textit", "texttt", "theta", "title", "today", "underline",
  "usepackage", "vspace",
];

const WITH_ARGUMENT = new Set([
  "author", "bibliography", "bibliographystyle", "caption", "chapter", "cite", "date", "emph",
  "footnote", "hspace", "include", "includegraphics", "input", "label", "paragraph", "parencite",
  "ref", "section", "sqrt", "textbf", "textit", "texttt", "title", "underline", "usepackage",
  "vspace",
]);

const ENVIRONMENTS = [
  "abstract", "align", "center", "description", "document", "enumerate", "equation", "figure",
  "itemize", "minipage", "quote", "table", "tabular", "verbatim",
];

const commandOptions: Completion[] = [
  snippetCompletion("\\begin{${environment}}\n\t${}\n\\end{${environment}}", {
    label: "\\begin",
    detail: "Umgebung",
  }),
  snippetCompletion("\\frac{${}}{${}}", { label: "\\frac" }),
  ...COMMANDS.filter((name) => name !== "begin" && name !== "frac").map((name) =>
    WITH_ARGUMENT.has(name)
      ? snippetCompletion(`\\${name}{\${}}`, { label: `\\${name}` })
      : { label: `\\${name}` },
  ),
];

const environmentOptions: Completion[] = ENVIRONMENTS.map((label) => ({ label }));

export function latexCompletions(context: CompletionContext) {
  const environment = context.matchBefore(/\\(?:begin|end)\{[a-zA-Z*]*/);
  if (environment) {
    return {
      from: environment.from + environment.text.indexOf("{") + 1,
      options: environmentOptions,
      validFor: /^[a-zA-Z*]*$/,
    };
  }

  const command = context.matchBefore(/\\[a-zA-Z]*/);
  if (!command) return null;
  return { from: command.from, options: commandOptions, validFor: /^\\[a-zA-Z]*$/ };
}
