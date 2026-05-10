import 'express-session';

declare module 'express-session' {
  interface CustomerSessionUser {
    id: string;
    customer_id: string;
    email: string;
    display_name: string;
  }

  interface SessionData {
    lastActivity?: number;
    customerUser?: CustomerSessionUser;
  }
}
