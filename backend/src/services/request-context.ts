import { User } from '../types';

export class RequestContext {
    private _user?: User;

    get user(): User | undefined {
        return this._user;
    }

    setUser(user: User | undefined): void {
        this._user = user;
    }

    get isAuthenticated(): boolean {
        return !!this._user;
    }

    requireAuth(): User {
        if (!this._user) {
            throw new Error('User is not authenticated');
        }
        return this._user;
    }

    clear(): void {
        this._user = undefined;
    }
}
