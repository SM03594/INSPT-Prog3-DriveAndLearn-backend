import mongoose from 'mongoose';
import ErrorMongooseObjIdInvalido from '../../errors/ErrorMongooseObjIdInvalido.js';

export function validarMongooseObjId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ErrorMongooseObjIdInvalido();
  }
}
