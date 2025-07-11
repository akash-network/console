export async function shutdownServer(server: ClosableServer | undefined): Promise<void> {
  if (!server || !server.listening) return;
  return new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export interface ClosableServer {
  close: (cb?: (error?: Error) => void) => void;
  listening: boolean;
}
