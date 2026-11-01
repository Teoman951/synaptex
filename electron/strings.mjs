// Texts the main process shows itself. The renderer reports the language.
const STRINGS = {
  de: {
    languageName: "Deutsch",
    pass: "Durchlauf {n}", passPage: "Durchlauf {n}, Seite {page}", bibliography: "Literaturverzeichnis",
    tectonic: "Tectonic läuft", noCompiler: "Kein LaTeX-Compiler gefunden.", noTectonic: "Tectonic wurde nicht gefunden.",
    timeout: "Zeitlimit beim Kompilieren überschritten.", noPdf: "Es wurde kein PDF erzeugt.",
    newFolder: "Neuen Projektordner anlegen", pickServer: "llama-server auswählen", pickModel: "GGUF-Modell auswählen",
    imageFilter: "Bilder", zipFilter: "ZIP-Archiv", modelFilter: "GGUF-Modell",
    updateAvailable: "SynapTeX {version} ist verfügbar. Jetzt herunterladen?", download: "Herunterladen", later: "Später",
    updateReady: "Das Update ist bereit. Jetzt neu starten?", restart: "Neu starten",
  },
  en: {
    languageName: "English",
    pass: "Pass {n}", passPage: "Pass {n}, page {page}", bibliography: "Bibliography",
    tectonic: "Tectonic running", noCompiler: "No LaTeX compiler found.", noTectonic: "Tectonic was not found.",
    timeout: "Compile time limit exceeded.", noPdf: "No PDF was created.",
    newFolder: "Create new project folder", pickServer: "Choose llama-server", pickModel: "Choose GGUF model",
    imageFilter: "Images", zipFilter: "ZIP archive", modelFilter: "GGUF model",
    updateAvailable: "SynapTeX {version} is available. Download now?", download: "Download", later: "Later",
    updateReady: "The update is ready. Restart now?", restart: "Restart",
  },
  tr: {
    languageName: "Türkçe",
    pass: "Geçiş {n}", passPage: "Geçiş {n}, sayfa {page}", bibliography: "Kaynakça",
    tectonic: "Tectonic çalışıyor", noCompiler: "LaTeX derleyicisi bulunamadı.", noTectonic: "Tectonic bulunamadı.",
    timeout: "Derleme süre sınırı aşıldı.", noPdf: "PDF oluşturulamadı.",
    newFolder: "Yeni proje klasörü oluştur", pickServer: "llama-server seç", pickModel: "GGUF modeli seç",
    imageFilter: "Görseller", zipFilter: "ZIP arşivi", modelFilter: "GGUF modeli",
    updateAvailable: "SynapTeX {version} kullanılabilir. Şimdi indirilsin mi?", download: "İndir", later: "Sonra",
    updateReady: "Güncelleme hazır. Şimdi yeniden başlatılsın mı?", restart: "Yeniden başlat",
  },
  es: {
    languageName: "español",
    pass: "Pasada {n}", passPage: "Pasada {n}, página {page}", bibliography: "Bibliografía",
    tectonic: "Tectonic en marcha", noCompiler: "No se encontró ningún compilador LaTeX.", noTectonic: "No se encontró Tectonic.",
    timeout: "Se superó el tiempo límite de compilación.", noPdf: "No se generó ningún PDF.",
    newFolder: "Crear carpeta de proyecto", pickServer: "Elegir llama-server", pickModel: "Elegir modelo GGUF",
    imageFilter: "Imágenes", zipFilter: "Archivo ZIP", modelFilter: "Modelo GGUF",
    updateAvailable: "SynapTeX {version} está disponible. ¿Descargar ahora?", download: "Descargar", later: "Más tarde",
    updateReady: "La actualización está lista. ¿Reiniciar ahora?", restart: "Reiniciar",
  },
  fr: {
    languageName: "français",
    pass: "Passe {n}", passPage: "Passe {n}, page {page}", bibliography: "Bibliographie",
    tectonic: "Tectonic en cours", noCompiler: "Aucun compilateur LaTeX trouvé.", noTectonic: "Tectonic est introuvable.",
    timeout: "Limite de temps de compilation dépassée.", noPdf: "Aucun PDF n'a été créé.",
    newFolder: "Créer un dossier de projet", pickServer: "Choisir llama-server", pickModel: "Choisir un modèle GGUF",
    imageFilter: "Images", zipFilter: "Archive ZIP", modelFilter: "Modèle GGUF",
    updateAvailable: "SynapTeX {version} est disponible. Télécharger maintenant ?", download: "Télécharger", later: "Plus tard",
    updateReady: "La mise à jour est prête. Redémarrer maintenant ?", restart: "Redémarrer",
  },
};

let language = "de";

export function setLanguage(next) {
  if (next in STRINGS) language = next;
}

export function text(key, values = {}) {
  return STRINGS[language][key].replace(/\{(\w+)\}/g, (_match, name) => String(values[name] ?? ""));
}
