/** The only message a caller gets when stored secrets cannot be read: the error handler echoes `message` for every `http-errors` instance regardless of `expose`. */
export const SECRET_UNREADABLE_ERROR_MESSAGE = "Unable to read stored secrets";

/** The data key is already the per-owner key rotation re-wraps, so a value is encrypted directly under it rather than under a per-value key wrapped by it. */
export const SECRET_AT_REST_KEY_MANAGEMENT = "dir";

export const SECRET_AT_REST_CONTENT_ENCRYPTION = "A256GCM";
