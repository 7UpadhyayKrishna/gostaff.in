type ApiErrorEnvelope = {
  success: false;
  error: string;
  message: string;
};

export function apiError(error: string, status: number, message = error) {
  const payload: ApiErrorEnvelope = {
    success: false,
    error,
    message,
  };

  return Response.json(payload, { status });
}
