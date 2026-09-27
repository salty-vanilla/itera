// Verifies an access token without tying handlers to an auth service.
// - Resolves to the user when the token is accepted.
// - Resolves to null when the token is not acceptable (the client's fault;
//   answered with 401).
// - Throws for server-side failures such as missing settings or an
//   unreachable key set (answered with 5xx).
export type Authenticator = {
  authenticate(token: string): Promise<{ userId: string } | null>;
};
