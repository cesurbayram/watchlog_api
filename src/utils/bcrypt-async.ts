import bcrypt from "bcryptjs";

export function hashPassword(plain: string, saltRounds: number): Promise<string> {
  return new Promise((resolve, reject) => {
    bcrypt.hash(plain, saltRounds, (err, hash) => {
      if (err) reject(err);
      else if (hash === undefined) reject(new Error("bcryptjs hash returned undefined"));
      else resolve(hash);
    });
  });
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    bcrypt.compare(plain, hash, (err, same) => {
      if (err) reject(err);
      else if (same === undefined) reject(new Error("bcryptjs compare returned undefined"));
      else resolve(same);
    });
  });
}
