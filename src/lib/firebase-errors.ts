const FIREBASE_PERMISSION_CODES = new Set([
  "permission-denied",
  "unauthenticated",
  "firestore/permission-denied",
  "firestore/unauthenticated",
]);

const getErrorCode = (error: unknown): string | null => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const isFirebasePermissionError = (error: unknown): boolean => {
  const code = getErrorCode(error);
  if (code && FIREBASE_PERMISSION_CODES.has(code)) return true;

  return /missing or insufficient permissions/i.test(getErrorMessage(error));
};

export const shouldSilenceCloudHistoryError = (error: unknown): boolean =>
  isFirebasePermissionError(error);
