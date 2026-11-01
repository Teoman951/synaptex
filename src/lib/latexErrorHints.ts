import { t } from "@/lib/i18n";

const HINTS: [RegExp, string][] = [
  [/There's no line here to end/, "hint.noLine"],
  [/Unicode character/, "hint.unicode"],
  [/Undefined control sequence/, "hint.undefined"],
  [/File `.*' not found/, "hint.file"],
  [/Missing \$ inserted/, "hint.math"],
  [/Missing \} inserted|Extra \}|Runaway argument/, "hint.braces"],
  [/\\begin\{.*\} .*ended by \\end\{.*\}/, "hint.environment"],
  [/Misplaced alignment tab character &/, "hint.ampersand"],
  [/Extra alignment tab/, "hint.columns"],
  [/Too many \}'s/, "hint.tooMany"],
  [/Paragraph ended before/, "hint.paragraph"],
  [/Environment .* undefined/, "hint.undefinedEnv"],
  [/Double (sub|super)script/, "hint.script"],
];

export function hintFor(message: string) {
  const key = HINTS.find(([pattern]) => pattern.test(message))?.[1];
  return key ? t(key) : null;
}
