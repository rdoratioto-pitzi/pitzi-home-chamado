import 'express-session';

declare module 'express-serve-static-core' {
  interface Request {
    sessionUser?: {
      userId: string;
      isAdmin: boolean;
    };
  }
}

declare module 'express-session' {
  interface SessionData {
    userId: string;
    isAdmin: boolean;
  }
}