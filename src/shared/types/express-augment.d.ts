// Augments Express Request with requestId and auth user
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
      user?: { id: number; email: string; role?: string };
    }
  }
}

export {};
