import 'express-session';

declare module 'express-session' {
    interface SessionData {
        user?: {
            id: number;
            name: string;
            email: string;
            role: string;
        };

        csrf?: string;
    }
}