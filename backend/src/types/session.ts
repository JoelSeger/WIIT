import 'express-session';
import { User } from './user.types';

declare module 'express-session' {
    interface SessionData {
        user?: User;
    }
}
