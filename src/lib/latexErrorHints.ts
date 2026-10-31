const HINTS: [RegExp, string][] = [
  [/There's no line here to end/, "Ein \\\\ steht ohne Text davor, oft direkt nach einer Überschrift oder Leerzeile. Entferne es; für Abstand nimm \\vspace{1em}."],
  [/Unicode character/, "pdfLaTeX kennt dieses Zeichen nicht. Ersetze es, oder kompiliere mit XeLaTeX oder LuaLaTeX."],
  [/Undefined control sequence/, "Der Befehl ist unbekannt. Prüfe die Schreibweise oder ob das nötige \\usepackage fehlt."],
  [/File `.*' not found/, "Die Datei fehlt. Prüfe Name, Pfad und Groß- und Kleinschreibung; bei Paketen die Paketinstallation."],
  [/Missing \$ inserted/, "Ein Mathe-Zeichen wie _ oder ^ steht außerhalb von $...$. Setze es in den Mathemodus oder schreibe \\_."],
  [/Missing \} inserted|Extra \}|Runaway argument/, "Geschweifte Klammern passen nicht zusammen. Prüfe die Stelle und die Zeilen davor."],
  [/\\begin\{.*\} .*ended by \\end\{.*\}/, "\\begin und \\end passen nicht zusammen. Prüfe, ob eine Umgebung falsch oder gar nicht geschlossen ist."],
  [/Misplaced alignment tab character &/, "Ein & steht außerhalb einer Tabelle. Schreibe im Text \\&."],
  [/Extra alignment tab/, "Eine Tabellenzeile hat mehr Spalten als im \\begin{tabular} festgelegt."],
  [/Too many \}'s/, "Hier steht eine schließende Klammer } zu viel."],
  [/Paragraph ended before/, "Einem Befehl fehlt die schließende Klammer, bevor ein neuer Absatz beginnt."],
  [/Environment .* undefined/, "Diese Umgebung ist unbekannt. Prüfe die Schreibweise oder ob ein \\usepackage fehlt."],
  [/Double (sub|super)script/, "Zwei _ oder ^ folgen direkt aufeinander. Fasse sie mit {} zusammen."],
];

export function hintFor(message: string) {
  return HINTS.find(([pattern]) => pattern.test(message))?.[1] ?? null;
}
