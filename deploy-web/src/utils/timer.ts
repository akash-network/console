export const Timer = (ms: number) => {
  let id;

  const start = () =>
    new Promise(resolve => {
      if (id === -1) {
        throw new Error("Timer already aborted");
      }

      id = setTimeout(resolve, ms);
    });

  const abort = () => {
    if (id !== -1 || id === undefined) {
      clearTimeout(id);
      id = -1;
    }
  };

  return {
    start,
    abort
  };
};
