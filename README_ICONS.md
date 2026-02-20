# App Icons Setup

Um das neue Icon vollständig zu integrieren, führen Sie bitte folgende Schritte aus, da ich keinen direkten Zugriff auf die Bilddatei im Chat habe:

1.  **Speichern Sie das Bild:**
    Speichern Sie das von Ihnen gesendete Bild als **`icon.png`**.

2.  **Kopieren Sie das Bild an zwei Orte:**
    *   `d:\Nyrox\public\icon.png` (Für die Web-Oberfläche und das Frontend)
    *   `d:\Nyrox\resources\icon.png` (Für das Windows-Programmicon)

3.  **Generieren Sie die iOS-Icons:**
    Sobald die Datei in `resources/icon.png` liegt, führen Sie folgenden Befehl im Terminal aus:
    ```bash
    npm run generate-assets
    ```
    Dies erstellt automatisch alle benötigten Icon-Größen für iPhone und iPad.

4.  **Windows App neu bauen:**
    Um die .exe mit dem neuen Icon zu erstellen:
    ```bash
    npm run dist
    ```
