import { createApp } from './app.js';
import { loadEnvironment } from './config.js';

const environment = loadEnvironment();

createApp().listen(environment.PORT, '127.0.0.1', () => {
  process.stdout.write(
    `Web3 backend engineering lab listening on http://127.0.0.1:${environment.PORT}\n`
  );
});
