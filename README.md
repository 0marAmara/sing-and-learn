# Sing and Learn

An Angular/PWA prototype for the supplied Arabic multiplication recording. Table 2 is playable today; the drawer shows tables 2–9 and keeps 3–9 marked as coming soon.

## Run

```sh
npm install
npm start
```

Open `http://127.0.0.1:4300/`.

The copied recording lives at `src/assets/audio/multiplication-song.mpeg`. The original file in Downloads is not changed.

## Set the ten questions

Choose **إعداد الأغنية** from the top bar. On a narrow screen, open the ☰ tables menu and choose **⚙ إعداد الأغنية للكبار**. The audio player lets you seek through the song. For each ordered row, enter times manually or use the current player position to mark the start and the stop before the spoken answer. Preview each segment, then choose **احفظ وجهّز اللعب**.

The draft is saved in browser storage. **نسخ JSON** copies the exact ten `{ start, end }` pairs, and the setup screen can download them as a file.

Once all ten boundaries are valid, the child can choose ordered or shuffled play. Correct and incorrect taps use short browser-generated feedback tones, first-attempt scores are saved locally, and the app offers a previous best score on the home screen. The service-worker configuration makes the production build installable as a PWA.

The bundled default timings are stored in `src/assets/timings.json` and load automatically on a fresh browser. They remain editable from **إعداد الأغنية** if you want to refine a boundary after listening again.
