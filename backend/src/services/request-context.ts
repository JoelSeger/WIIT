import { injectable } from 'tsyringe';
import { User } from '../types';

@injectable
export class RequestContext {
  private _user?: User;
}
