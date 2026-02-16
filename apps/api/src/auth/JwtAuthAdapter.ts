export type JwtClaims = {
  sub: string;
  tid?: string;
  email?: string;
  roles?: string[];
};

/**
 * Placeholder for Azure JWT validation in production mode.
 *
 * Future implementation should:
 * 1) Validate issuer/audience/signature using OpenID metadata.
 * 2) Map claims to tenant context and roles.
 * 3) Reject tokens without tenant scope.
 */
export class JwtAuthAdapter {
  public async validateAndParse(authorizationHeader: string): Promise<JwtClaims> {
    void authorizationHeader;
    throw new Error('JwtAuthAdapter is not implemented yet.');
  }
}
