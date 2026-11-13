# Sing and Learn

An Angular/PWA prototype for the supplied Arabic multiplication recordings. The drawer contains tables 2–9 with their bundled recordings.

## Run

```sh
npm install
npm start
```

Open `http://127.0.0.1:4300/`.

The copied recordings live in `src/assets/audio/`. The original files in Downloads are not changed. Audio is configured as a lazy service-worker asset: the first visit loads the app shell only, and a table recording is requested after the child starts that table.

## Timing data

The ten boundaries for each table are maintained in `src/assets/timings.json`. Edit that file when a recording needs a timing adjustment, then rebuild and deploy the app.

Once all ten boundaries are valid, the child can choose ordered or shuffled play. Correct and incorrect taps use short browser-generated feedback tones, first-attempt scores are saved locally, and the app offers a previous best score on the home screen. The service-worker configuration makes the production build installable as a PWA.

The bundled timings are stored in `src/assets/timings.json` and are the runtime source for tables 2–9. The child-facing app does not expose timing editing, so changes should be made in that JSON file and deployed with the next build. The home screen includes the supplied artwork, links to the provided learning videos, and a same-tab link from the **حكاية حصة** poster to the Rehab El-Zawawi YouTube channel.
