// Test app setup - loads config and returns supertest agent for API requests
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.dev', override: false });  // Don't override NODE_ENV=test set by test scripts

import supertest from 'supertest';
import { loadAndValidateConfig } from '../../src/infrastructure/config/config.loader';

// Must load config BEFORE importing app. When compiled to CommonJS, this runs in order.
loadAndValidateConfig();

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
