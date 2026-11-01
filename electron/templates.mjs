const GERMAN = String.raw`\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[ngerman]{babel}
`;

export const TEMPLATES = [
  {
    id: "hausarbeit",
    name: "Hausarbeit",
    category: "Studium",
    source: String.raw`\documentclass[12pt,a4paper]{article}
${GERMAN}\usepackage[margin=2.5cm]{geometry}

\title{Titel der Hausarbeit}
\author{Vorname Nachname}
\date{\today}

\begin{document}
\maketitle
\tableofcontents
\newpage

\section{Einleitung}
Hier beschreibst du Thema, Fragestellung und Aufbau der Arbeit.

\section{Hauptteil}
Hier steht deine Argumentation.

\section{Fazit}
Hier fasst du die Ergebnisse zusammen.

\end{document}
`,
  },
  {
    id: "abschlussarbeit",
    name: "Bachelor- oder Masterarbeit",
    category: "Studium",
    source: String.raw`\documentclass[12pt,a4paper]{report}
${GERMAN}\usepackage[margin=2.5cm]{geometry}

\begin{document}

\begin{titlepage}
  \centering
  \vspace*{4cm}
  {\Huge Titel der Arbeit\par}
  \vspace{2cm}
  {\Large Bachelorarbeit\par}
  \vspace{1cm}
  {\large Vorname Nachname\par}
  \vfill
  {\large Hochschule, \today\par}
\end{titlepage}

\tableofcontents

\chapter{Einleitung}
Motivation und Zielsetzung der Arbeit.

\chapter{Grundlagen}
Theoretischer Hintergrund.

\chapter{Umsetzung}
Vorgehen und Ergebnisse.

\chapter{Fazit}
Zusammenfassung und Ausblick.

\end{document}
`,
  },
  {
    id: "praktikumsbericht",
    name: "Praktikumsbericht",
    category: "Studium",
    source: String.raw`\documentclass[11pt,a4paper]{article}
${GERMAN}\usepackage[margin=2.5cm]{geometry}

\title{Praktikumsbericht}
\author{Vorname Nachname}
\date{Zeitraum: TT.MM.JJJJ bis TT.MM.JJJJ}

\begin{document}
\maketitle

\section{Unternehmen}
Kurze Vorstellung des Unternehmens.

\section{Aufgaben}
Was du während des Praktikums gemacht hast.

\section{Reflexion}
Was du gelernt hast.

\end{document}
`,
  },
  {
    id: "lebenslauf",
    name: "Lebenslauf",
    category: "Bewerbung",
    source: String.raw`\documentclass[11pt,a4paper]{article}
${GERMAN}\usepackage[margin=2cm]{geometry}
\pagestyle{empty}
\setlength{\parindent}{0pt}

\newcommand{\eintrag}[2]{\noindent\parbox[t]{3.5cm}{#1}\parbox[t]{13cm}{#2}\par\medskip}

\begin{document}

{\LARGE\bfseries Vorname Nachname}\par
\smallskip
Straße 1, 12345 Stadt\quad|\quad mail@example.com\quad|\quad 0123 456789

\section*{Berufserfahrung}
\eintrag{2024 bis heute}{\textbf{Position}, Unternehmen\\Kurze Beschreibung deiner Aufgaben.}

\section*{Ausbildung}
\eintrag{2020 bis 2024}{\textbf{Abschluss}, Hochschule}

\section*{Kenntnisse}
\eintrag{Sprachen}{Deutsch, Englisch}

\end{document}
`,
  },
  {
    id: "anschreiben",
    name: "Anschreiben",
    category: "Bewerbung",
    source: String.raw`\documentclass[11pt,a4paper]{article}
${GERMAN}\usepackage[margin=2.5cm]{geometry}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0.8em}

\begin{document}

Vorname Nachname\\
Straße 1\\
12345 Stadt

\bigskip
Unternehmen\\
Ansprechperson\\
Straße 2\\
54321 Stadt

\begin{flushright}
Stadt, \today
\end{flushright}

\textbf{Bewerbung als Position}

Sehr geehrte Damen und Herren,

hier schreibst du, warum du gut zur Stelle passt.

Mit freundlichen Grüßen

\vspace{1.5cm}
Vorname Nachname

\end{document}
`,
  },
  {
    id: "praesentation",
    name: "Präsentation",
    category: "Präsentieren",
    source: String.raw`\documentclass{beamer}
${GERMAN}
\title{Titel der Präsentation}
\author{Vorname Nachname}
\date{\today}

\begin{document}

\begin{frame}
  \titlepage
\end{frame}

\begin{frame}{Überblick}
  \begin{itemize}
    \item Erster Punkt
    \item Zweiter Punkt
  \end{itemize}
\end{frame}

\begin{frame}{Fazit}
  Die wichtigste Aussage.
\end{frame}

\end{document}
`,
  },
  {
    id: "poster",
    name: "Wissenschaftliches Poster",
    category: "Präsentieren",
    source: String.raw`\documentclass[12pt]{article}
${GERMAN}\usepackage[a2paper,margin=2cm]{geometry}
\usepackage{multicol}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\columnsep}{1.5cm}

\begin{document}

\begin{center}
  {\Huge\bfseries Titel des Posters\par}
  \bigskip
  {\Large Vorname Nachname, Hochschule\par}
\end{center}

\vspace{1cm}

\begin{multicols}{3}
\section*{Einleitung}
Worum es geht.

\section*{Methode}
Wie du vorgegangen bist.

\section*{Ergebnisse}
Was herausgekommen ist.
\end{multicols}

\end{document}
`,
  },
  {
    id: "brief",
    name: "Brief (DIN 5008)",
    category: "Alltag",
    source: String.raw`\documentclass[fontsize=11pt,paper=a4,version=last]{scrlttr2}
${GERMAN}
\setkomavar{fromname}{Vorname Nachname}
\setkomavar{fromaddress}{Straße 1\\12345 Stadt}
\setkomavar{date}{\today}
\setkomavar{subject}{Betreff des Briefs}

\begin{document}

\begin{letter}{Empfänger\\Straße 2\\54321 Stadt}
\opening{Sehr geehrte Damen und Herren,}

hier steht dein Text.

\closing{Mit freundlichen Grüßen}
\end{letter}

\end{document}
`,
  },
  {
    id: "flyer",
    name: "Flyer",
    category: "Alltag",
    source: String.raw`\documentclass[12pt,a5paper]{article}
${GERMAN}\usepackage[margin=1.5cm]{geometry}
\usepackage{xcolor}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\definecolor{akzent}{HTML}{2563EB}

\begin{document}

\begin{center}
  {\Huge\bfseries\color{akzent} Dein Titel\par}
  \medskip
  {\Large Eine kurze, klare Botschaft\par}
\end{center}

\vspace{1cm}

\textbf{Wann:} Datum und Uhrzeit

\textbf{Wo:} Ort

\vspace{1cm}

Hier beschreibst du in zwei bis drei Sätzen, worum es geht.

\vfill
\begin{center}
  {\color{akzent} mail@example.com}
\end{center}

\end{document}
`,
  },
  {
    id: "rechnung",
    name: "Rechnung",
    category: "Alltag",
    source: String.raw`\documentclass[11pt,a4paper]{article}
${GERMAN}\usepackage[margin=2.5cm]{geometry}
\pagestyle{empty}
\setlength{\parindent}{0pt}

\begin{document}

Vorname Nachname, Straße 1, 12345 Stadt

\bigskip
Kunde\\
Straße 2\\
54321 Stadt

\bigskip
{\Large\bfseries Rechnung Nr. 1}

Datum: \today

\bigskip
\begin{tabular}{p{9cm}r}
  \hline
  Leistung & Betrag \\
  \hline
  Beispielleistung & 100,00 EUR \\
  \hline
  \textbf{Gesamt} & \textbf{100,00 EUR} \\
  \hline
\end{tabular}

\bigskip
Bitte überweise den Betrag innerhalb von 14 Tagen.

\end{document}
`,
  },
];
