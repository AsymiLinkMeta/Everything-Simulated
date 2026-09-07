export function createServerFn(_opts?: { method?: string }) {
  const api: {
    middleware: (m: unknown) => typeof api;
    validator: (v: unknown) => typeof api;
    handler: (h: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown;
  } = {
    middleware: () => api,
    validator: () => api,
    handler: (h) => {
      const fn = async (args?: unknown) => h({ context: { userId: "bolt-demo" }, data: args });
      return fn;
    },
  };
  return api;
}
