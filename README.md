# Sing and Learn

An Angular/PWA prototype for the supplied Arabic multiplication recordings. The drawer contains tables 2–9, including the newly added table 8 recording.

## Run

```sh
npm install
npm start
```

Open `http://127.0.0.1:4300/`.

The copied recordings live in `src/assets/audio/`. The original files in Downloads are not changed. Audio is configured as a lazy service-worker asset: the first visit loads the app shell only, and a table recording is requested after the child starts that table.

## Set the ten questions

Choose **إعداد الأغنية** from the top bar. On a narrow screen, open the ☰ tables menu and choose **⚙ إعداد الأغنية للكبار**. The audio player lets you seek through the song. For each ordered row, enter times manually or use the current player position to mark the start and the stop before the spoken answer. Preview each segment, then choose **احفظ وجهّز اللعب**.

The draft is saved in browser storage. **نسخ JSON** copies every table configuration (including all ten rows per table) plus the learning-video placeholders, and the setup screen can download the same data as a file.

Once all ten boundaries are valid, the child can choose ordered or shuffled play. Correct and incorrect taps use short browser-generated feedback tones, first-attempt scores are saved locally, and the app offers a previous best score on the home screen. The service-worker configuration makes the production build installable as a PWA.

The bundled default timings are stored in `src/assets/timings.json` and load automatically on a fresh browser. Table 2 contains the supplied boundaries; the other available recordings, including table 8, start with empty rows for timing review. They remain editable from **إعداد الأغنية** if you want to refine a boundary after listening again. The home and completion screens also include a replaceable YouTube learning-card placeholder and the supplied artwork with the people removed.
