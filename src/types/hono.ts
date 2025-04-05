import { InchService } from '../services/inchService';

declare module 'hono' {
  interface ContextVariableMap {
    inchService: InchService;
  }
}
