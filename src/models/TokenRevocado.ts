import { model, Schema } from 'mongoose';

const tokenRevocadoSchema = new Schema(
  {
    hash: { type: String, required: true, unique: true },
    expiraEn: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    collection: 'tokens_revocados',
    versionKey: false,
  },
);

export interface TokenRevocado {
  hash: string;
  expiraEn: Date;
}

export const TokenRevocadoModel = model<TokenRevocado>(
  'TokenRevocado',
  tokenRevocadoSchema,
);