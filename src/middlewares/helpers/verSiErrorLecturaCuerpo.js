import ErrorLecturaCuerpo from '../../errors/ErrorLecturaCuerpo.js';

export function verSiErrorLecturaCuerpo(err) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return new ErrorLecturaCuerpo();
  }

  return err;
}
