type SecurityRequirement = Record<string, string[]>;

export const SECURITY_BEARER: SecurityRequirement[] = [{ BearerAuth: [] }];
export const SECURITY_API_KEY: SecurityRequirement[] = [{ ApiKeyAuth: [] }];
export const SECURITY_BEARER_OR_API_KEY: SecurityRequirement[] = [{ BearerAuth: [] }, { ApiKeyAuth: [] }];
export const SECURITY_NONE: SecurityRequirement[] = [];
