declare global {
  namespace Express {
    interface Request {
      auth?: {
        id: string;
        role: 'alumno' | 'administrador';
        token: string;
        exp: number;
      };
    }
  }
}

export {};
