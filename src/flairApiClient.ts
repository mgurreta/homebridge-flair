import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import type { Logger } from 'homebridge';
import {
  Model,
  Puck,
  Room,
  Structure,
  StructureHeatCoolMode,
  User,
  Vent,
} from '@ds-flair/flair-api-ts';

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

interface OAuthTokenState {
  accessToken: string;
  tokenType: string;
  refreshToken?: string;
  scope?: string;
  expiresAt: Date;
}

interface GrantAttempt {
  name: string;
  grantType: string;
  buildParams: () => URLSearchParams;
}

const TOKEN_EXPIRY_BUFFER_SECONDS = 20;

export class FlairApiClient {
  private readonly http: AxiosInstance;
  private token?: OAuthTokenState;
  private pendingAuth?: Promise<void>;
  private readonly scopes: string[];
  private readonly grantType: string;
  private readonly realm?: string;
  private readonly tokenEndpoints: string[];

  constructor(
    private readonly options: {
      clientId: string;
      clientSecret: string;
      username?: string;
      password?: string;
      logger?: Logger;
      baseURL?: string;
      scopes?: string[];
      grantType?: string;
      realm?: string;
      tokenEndpoints?: string[];
    },
  ) {
    this.scopes = this.options.scopes && this.options.scopes.length > 0 ? this.options.scopes : FlairApiClient.defaultScopes;
    this.http = axios.create({
      baseURL: this.options.baseURL ?? 'https://api.flair.co',
      headers: {
        Accept: 'application/vnd.api+json, application/json',
      },
    });
    this.grantType = this.options.grantType ?? 'password';
    this.realm = this.options.realm;
    const defaultEndpoints = ['/oauth2/token', '/oauth/token'];
    this.tokenEndpoints = this.options.tokenEndpoints && this.options.tokenEndpoints.length > 0
      ? this.options.tokenEndpoints
      : defaultEndpoints;
  }

  private static readonly defaultScopes: string[] = [
    'structures.edit',
    'structures.view',
    'pucks.view',
    'pucks.edit',
    'vents.view',
    'vents.edit',
    'users.view',
  ];

  public async getUsers(): Promise<User[]> {
    const response = await this.request(() => this.http.get('/api/users'));
    return response.data.data.map((entry: any) => new User().fromJSON(entry));
  }

  public async getStructures(): Promise<Structure[]> {
    const response = await this.request(() => this.http.get('/api/structures'));
    return response.data.data.map((entry: any) => new Structure().fromJSON(entry));
  }

  public async getStructure(structure: Structure): Promise<Structure> {
    const response = await this.request(() => this.http.get(`/api/structures/${structure.id}`));
    return structure.fromJSON(response.data.data);
  }

  public async getPrimaryStructure(): Promise<Structure> {
    const structures = await this.getStructures();
    if (structures.length === 1) {
      return structures[0];
    }

    const primary = structures.find((item) => item.isPrimaryHome());
    if (!primary) {
      throw new Error('No primary structure found for Flair account');
    }
    return primary;
  }

  public async setStructureMode(structure: Structure, mode: StructureHeatCoolMode): Promise<Structure> {
    const response = await this.request(() => this.http.patch(`/api/structures/${structure.id}`, {
      data: {
        type: Structure.type,
        attributes: {
          mode,
        },
        relationships: {},
      },
    }));

    return structure.fromJSON(response.data.data);
  }

  public async setStructureHeatingCoolMode(structure: Structure, mode: StructureHeatCoolMode): Promise<Structure> {
    const response = await this.request(() => this.http.patch(`/api/structures/${structure.id}`, {
      data: {
        type: Structure.type,
        attributes: {
          'structure-heat-cool-mode': mode,
        },
        relationships: {},
      },
    }));

    return structure.fromJSON(response.data.data);
  }

  public async setStructureSetPoint(structure: Structure, setPointC: number): Promise<Structure> {
    const response = await this.request(() => this.http.patch(`/api/structures/${structure.id}`, {
      data: {
        type: Structure.type,
        attributes: {
          'set-point-temperature-c': setPointC,
        },
        relationships: {},
      },
    }));

    return structure.fromJSON(response.data.data);
  }

  public async getRooms(): Promise<Room[]> {
    const response = await this.request(() => this.http.get('/api/rooms'));
    return response.data.data.map((entry: any) => new Room().fromJSON(entry));
  }

  public async getRoom(room: Room): Promise<Room> {
    const response = await this.request(() => this.http.get(`/api/rooms/${room.id}`));
    return room.fromJSON(response.data.data);
  }

  public async setRoomSetPoint(room: Room, setPointC: number): Promise<Room> {
    const response = await this.request(() => this.http.patch(`/api/rooms/${room.id}`, {
      data: {
        type: Room.type,
        attributes: {
          'set-point-c': setPointC,
        },
        relationships: {},
      },
    }));

    return room.fromJSON(response.data.data);
  }

  public async setRoomAway(room: Room, setAway: boolean): Promise<Room> {
    const response = await this.request(() => this.http.patch(`/api/rooms/${room.id}`, {
      data: {
        type: Room.type,
        attributes: {
          active: !setAway,
        },
        relationships: {},
      },
    }));

    return room.fromJSON(response.data.data);
  }

  public async getPucks(): Promise<Puck[]> {
    const response = await this.request(() => this.http.get('/api/pucks'));
    return response.data.data.map((entry: any) => new Puck().fromJSON(entry));
  }

  public async getPuckReading(puck: Puck): Promise<Puck> {
    const response = await this.request(() => this.http.get(`/api/pucks/${puck.id}/current-reading`));
    puck.setCurrentReading(response.data.data);
    return puck;
  }

  public async getVents(): Promise<Vent[]> {
    const response = await this.request(() => this.http.get('/api/vents'));
    return response.data.data.map((entry: any) => new Vent().fromJSON(entry));
  }

  public async getVentReading(vent: Vent): Promise<Vent> {
    const response = await this.request(() => this.http.get(`/api/vents/${vent.id}/current-reading`));
    vent.setCurrentReading(response.data.data);
    return vent;
  }

  public async setVentPercentOpen(vent: Vent, percentOpen: number): Promise<Vent> {
    const response = await this.request(() => this.http.patch(`/api/vents/${vent.id}`, {
      data: {
        type: Vent.type,
        attributes: {
          'percent-open': percentOpen,
        },
        relationships: {},
      },
    }));

    vent.fromJSON(response.data.data);
    return vent;
  }

  private async request<T = any>(fn: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    await this.ensureAccessToken();

    try {
      return await fn();
    } catch (error) {
      if (this.isAuthError(error)) {
        await this.ensureAccessToken(true);
        return fn();
      }
      throw error;
    }
  }

  private async ensureAccessToken(forceRefresh = false): Promise<void> {
    if (this.pendingAuth) {
      await this.pendingAuth;
      if (!forceRefresh && this.token && !this.isTokenExpired(this.token)) {
        this.applyAuthHeader(this.token);
        return;
      }
    }

    if (!forceRefresh && this.token && !this.isTokenExpired(this.token)) {
      this.applyAuthHeader(this.token);
      return;
    }

    this.pendingAuth = this.acquireToken(forceRefresh);
    try {
      await this.pendingAuth;
    } finally {
      this.pendingAuth = undefined;
    }
  }

  private async acquireToken(forceRefresh: boolean): Promise<void> {
    if (forceRefresh) {
      this.options.logger?.debug('Forcing Flair OAuth token refresh');
    }

    if (this.token?.refreshToken) {
      try {
        await this.refreshAccessToken();
        return;
      } catch (error) {
        this.options.logger?.warn?.('Failed to refresh Flair OAuth token, requesting a new token.', this.safeErrorMessage(error));
      }
    }

    await this.requestInitialToken();
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.token?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', this.token.refreshToken);
    params.append('scope', this.scopes.join(' '));

    const token = await this.postTokenRequest(params);
    this.setTokenState(token);
  }

  private async requestInitialToken(): Promise<void> {
    const attempts = this.buildGrantAttempts();
    let lastError: unknown;

    for (const attempt of attempts) {
      try {
        const params = attempt.buildParams();
        params.append('scope', this.scopes.join(' '));
        const token = await this.postTokenRequest(params);
        this.setTokenState(token);
        return;
      } catch (error) {
        lastError = error;
        if (!this.shouldTryNextGrant(error)) {
          throw error;
        }
        this.options.logger?.warn?.(`Grant ${attempt.name} failed: ${this.safeErrorMessage(error)}. Trying next option.`);
      }
    }

    throw lastError ?? new Error('Unable to acquire Flair OAuth token');
  }

  private setTokenState(token: OAuthTokenResponse): void {
    const expiresAt = new Date(Date.now() + Math.max(0, token.expires_in - TOKEN_EXPIRY_BUFFER_SECONDS) * 1000);
    this.token = {
      accessToken: token.access_token,
      tokenType: token.token_type,
      refreshToken: token.refresh_token,
      scope: token.scope,
      expiresAt,
    };
    this.applyAuthHeader(this.token);
  }

  private isTokenExpired(token: OAuthTokenState): boolean {
    return token.expiresAt.getTime() <= Date.now();
  }

  private applyAuthHeader(token: OAuthTokenState): void {
    this.http.defaults.headers.common.Authorization = `${token.tokenType} ${token.accessToken}`;
  }

  private getBasicAuthHeader(): string {
    const credentials = `${this.options.clientId}:${this.options.clientSecret}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  private buildGrantAttempts(): GrantAttempt[] {
    const attempts: GrantAttempt[] = [];
    const configuredGrant = this.options.grantType;

    if (configuredGrant) {
      attempts.push(this.createGrantAttempt(configuredGrant));
      return this.dedupeGrantAttempts(attempts);
    }

    if (this.options.username && this.options.password) {
      attempts.push(this.createGrantAttempt('password'));
      attempts.push(this.createGrantAttempt('password-realm'));
    }

    attempts.push(this.createGrantAttempt('client_credentials'));

    return this.dedupeGrantAttempts(attempts);
  }

  private createGrantAttempt(grantType: string): GrantAttempt {
    const normalizedGrant = this.normalizeGrantType(grantType);

    return {
      name: normalizedGrant,
      grantType: normalizedGrant,
      buildParams: () => {
        const params = new URLSearchParams();

        if (normalizedGrant === 'password') {
          if (!this.options.username || !this.options.password) {
            throw new Error('Username and password are required when using the password grant type.');
          }
          params.append('grant_type', 'password');
          params.append('username', this.options.username!);
          params.append('password', this.options.password!);
        } else if (normalizedGrant === 'http://auth0.com/oauth/grant-type/password-realm') {
          if (!this.options.username || !this.options.password) {
            throw new Error('Username and password are required when using the password realm grant type.');
          }
          params.append('grant_type', 'http://auth0.com/oauth/grant-type/password-realm');
          params.append('username', this.options.username!);
          params.append('password', this.options.password!);
          params.append('realm', this.realm ?? 'Username-Password-Authentication');
        } else {
          params.append('grant_type', normalizedGrant);
        }

        params.append('client_id', this.options.clientId);
        params.append('client_secret', this.options.clientSecret);

        return params;
      },
    };
  }

  private normalizeGrantType(grantType: string): string {
    if (grantType === 'password' || grantType === 'client_credentials') {
      return grantType;
    }

    if (grantType === 'password-realm') {
      return 'http://auth0.com/oauth/grant-type/password-realm';
    }

    return grantType;
  }

  private dedupeGrantAttempts(attempts: GrantAttempt[]): GrantAttempt[] {
    const seen = new Set<string>();
    const result: GrantAttempt[] = [];

    for (const attempt of attempts) {
      if (seen.has(attempt.grantType)) {
        continue;
      }
      seen.add(attempt.grantType);
      result.push(attempt);
    }

    return result;
  }

  private shouldTryNextGrant(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }

    const response = error.response;
    if (!response) {
      return false;
    }

    const code = (response.data as { error?: string } | undefined)?.error;
    return code === 'unsupported_grant_type'
      || code === 'invalid_grant'
      || code === 'invalid_request'
      || code === 'invalid_client';
  }

  private async postTokenRequest(params: URLSearchParams): Promise<OAuthTokenResponse> {
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: this.getBasicAuthHeader(),
    };

    const body = params.toString();
    let lastError: unknown;

    for (const endpoint of this.tokenEndpoints) {
      try {
        const response = await this.http.post<OAuthTokenResponse>(endpoint, body, { headers });
        return response.data;
      } catch (error) {
        lastError = error;
        if (!axios.isAxiosError(error)) {
          continue;
        }

        if (!error.response) {
          continue;
        }

        const isLastEndpoint = endpoint === this.tokenEndpoints[this.tokenEndpoints.length - 1];
        const errorCode = error.response.data?.error;
        const shouldRetry = !isLastEndpoint && (
          error.response.status === 404 ||
          error.response.status === 401 ||
          errorCode === 'unsupported_grant_type'
        );

        if (shouldRetry) {
          this.options.logger?.debug?.(`Retrying token request against fallback endpoint: ${endpoint} (error: ${errorCode ?? error.response.status})`);
          continue;
        }

        throw error;
      }
    }

    throw lastError ?? new Error('Unknown error requesting Flair OAuth token');
  }

  private isAuthError(error: unknown): boolean {
    return axios.isAxiosError(error) && error.response?.status === 401;
  }

  private safeErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; error_description?: string }>;
      const serverMessage = axiosError.response?.data?.error_description || axiosError.response?.data?.error;
      return serverMessage ?? axiosError.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}

export type FlairApiModel = Model;
