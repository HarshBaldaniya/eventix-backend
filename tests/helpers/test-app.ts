// Test app setup - loads config and returns supertest agent for API requests
import supertest from 'supertest';
import { loadAndValidateConfig } from '../../src/infrastructure/config/config.loader';
import { app } from '../../src/app';

let configLoaded = false;

function ensureConfig(): void {
  if (!configLoaded) {
    loadAndValidateConfig();
    configLoaded = true;
  }
}

// Returns supertest agent bound to Express app; config loaded on first use
export function getTestAgent() {
  ensureConfig();
  return supertest(app);
}
