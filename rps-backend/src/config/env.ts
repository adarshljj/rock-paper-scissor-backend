import "dotenv/config";

export const env = {
  port: Number(process.env.PORT) || 3000,
};
