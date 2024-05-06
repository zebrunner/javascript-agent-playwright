export const waitUntil = (predFn: () => boolean) => {
  const poll = (resolve) => (predFn() ? resolve() : setTimeout(() => poll(resolve), 500));

  return new Promise(poll);
};
