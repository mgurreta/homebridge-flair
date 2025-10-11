import 'dotenv/config';
import axios from 'axios';
import type { Logger } from 'homebridge';
import { FlairApiClient } from '../src/flairApiClient';

interface EnvConfig {
  clientId: string;
  clientSecret: string;
  username?: string;
  password?: string;
  baseURL?: string;
  scopes?: string[];
  grantType?: string;
  realm?: string;
  tokenEndpoints?: string[];
}

class ConsoleLogger implements Logger {
  public prefix = '';
  constructor(private readonly verbose: boolean) {}

  log(message: string, ...parameters: unknown[]): void {
    console.log(message, ...parameters);
  }

  info(message: string, ...parameters: unknown[]): void {
    console.info(message, ...parameters);
  }

  warn(message: string, ...parameters: unknown[]): void {
    console.warn(message, ...parameters);
  }

  error(message: string, ...parameters: unknown[]): void {
    console.error(message, ...parameters);
  }

  debug(message: string, ...parameters: unknown[]): void {
    if (this.verbose) {
      console.debug(message, ...parameters);
    }
  }

  success(message: string, ...parameters: unknown[]): void {
    console.info(message, ...parameters);
  }
}

function loadConfig(): EnvConfig {
  const grantTypeEnv = (process.env.FLAIR_OAUTH_GRANT_TYPE || '').trim();
  const normalizedGrant = grantTypeEnv.toLowerCase();
  const requiresUser =
    normalizedGrant === '' ||
    normalizedGrant === 'password' ||
    normalizedGrant === 'password-realm' ||
    grantTypeEnv === 'http://auth0.com/oauth/grant-type/password-realm';

  const requiredVars: Array<[string, string | undefined]> = [
    ['FLAIR_CLIENT_ID', process.env.FLAIR_CLIENT_ID],
    ['FLAIR_CLIENT_SECRET', process.env.FLAIR_CLIENT_SECRET],
  ];

  if (requiresUser) {
    requiredVars.push(['FLAIR_USERNAME', process.env.FLAIR_USERNAME]);
    requiredVars.push(['FLAIR_PASSWORD', process.env.FLAIR_PASSWORD]);
  }

  const missing = requiredVars
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const scopes = (process.env.FLAIR_OAUTH_SCOPES || '')
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);

  return {
    clientId: process.env.FLAIR_CLIENT_ID!,
    clientSecret: process.env.FLAIR_CLIENT_SECRET!,
    username: process.env.FLAIR_USERNAME,
    password: process.env.FLAIR_PASSWORD,
    baseURL: process.env.FLAIR_API_BASE_URL,
    scopes: scopes.length > 0 ? scopes : undefined,
    grantType: grantTypeEnv || undefined,
    realm: process.env.FLAIR_OAUTH_REALM,
    tokenEndpoints: (() => {
      const endpoints = (process.env.FLAIR_OAUTH_TOKEN_ENDPOINTS || '')
        .split(',')
        .map((endpoint) => endpoint.trim())
        .filter((endpoint) => endpoint.length > 0);
      return endpoints.length > 0 ? endpoints : undefined;
    })(),
  };
}

async function run(): Promise<void> {
  const config = loadConfig();
  const verbose = (process.env.DEBUG || '').toLowerCase() === 'true';
  const logger = new ConsoleLogger(verbose);

  console.log(
    `Using grant: ${config.grantType ?? 'password'} | username provided: ${Boolean(config.username)} | custom token endpoints: ${config.tokenEndpoints ? config.tokenEndpoints.join(', ') : 'default'}`,
  );

  const client = new FlairApiClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    username: config.username,
    password: config.password,
    baseURL: config.baseURL,
    scopes: config.scopes,
    grantType: config.grantType,
    realm: config.realm,
    tokenEndpoints: config.tokenEndpoints,
    logger,
  });

  console.log('Running Flair OAuth smoke test…');

  const users = await client.getUsers();
  console.log(`✓ Retrieved ${users.length} user(s)`);

  const primaryStructure = await client.getPrimaryStructure();
  console.log(`✓ Primary structure: ${primaryStructure.name}`);

  const rooms = await client.getRooms();
  console.log(`✓ Retrieved ${rooms.length} room(s)`);

  const vents = await client.getVents();
  console.log(`✓ Retrieved ${vents.length} vent(s)`);

  if (vents.length > 0) {
    await client.getVentReading(vents[0]);
    console.log(`✓ Verified vent reading for ${vents[0].name}`);
  }

  console.log('Flair OAuth smoke test completed successfully.');
}

run().catch((error) => {
  console.error('Flair OAuth smoke test failed.');
  if (axios.isAxiosError(error) && error.response) {
    console.error(`HTTP ${error.response.status}`);
    if (error.response.data) {
      console.error(JSON.stringify(error.response.data));
    }
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
