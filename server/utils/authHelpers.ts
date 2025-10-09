export function resolveUserId(user: any): string {
  if (!user) {
    throw new Error('Missing authenticated user context');
  }

  if (user.provider === 'google') {
    return user.id;
  }

  if (user.claims?.sub) {
    return user.claims.sub;
  }

  throw new Error('Unable to resolve authenticated user identifier');
}
