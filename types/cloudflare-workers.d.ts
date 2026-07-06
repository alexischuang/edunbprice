declare module "cloudflare:workers" {
  export const env: {
    DB?: unknown;
  };
}

declare global {
  interface Fetcher {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  }

  interface D1Database {
    prepare(query: string): {
      run<T = unknown>(): Promise<T>;
      all<T = unknown>(): Promise<T[]>;
      first<T = unknown>(): Promise<T | null>;
    };
  }
}

export {};
