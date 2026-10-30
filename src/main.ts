import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode() })],
}).catch(error => console.error(error));
