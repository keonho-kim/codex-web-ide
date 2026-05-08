export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : typeof error === "string" ? error : "Request failed.";
}
