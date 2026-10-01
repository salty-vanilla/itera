// Where the auth service answers its own requests: sign-in, OAuth callbacks,
// passkeys, sign-out and the session. Web and API share one origin, so the
// session cookie reaches these routes and the API's routes alike.
export const authBasePath = '/api/auth';

// Identifies the user of a request without tying handlers to an auth service.
export type Authenticator = {
  // Reads the session the request carries (its cookie) from the headers.
  // - Resolves to the user when the session is valid.
  // - Resolves to null when there is no valid session (the client's fault;
  //   answered with 401).
  // - Throws for server-side failures such as missing settings or an
  //   unreachable database (answered with 5xx).
  authenticate(headers: Headers): Promise<{ userId: string } | null>;
  // Answers a request under authBasePath.
  handle(request: Request): Promise<Response>;
};
