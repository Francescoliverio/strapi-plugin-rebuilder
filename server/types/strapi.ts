export interface StrapiStore {
  get(options: { key: string }): Promise<unknown>;
  set(options: { key: string; value: unknown }): Promise<void>;
}

export interface StrapiLike {
  plugin(name: string): {
    service(name: string): any;
  };
  store(options: { type: string; name: string }): StrapiStore;
  log: {
    error(message: string, details?: unknown): void;
  };
}

export interface StrapiLifecycleContext {
  strapi: StrapiLike;
}
