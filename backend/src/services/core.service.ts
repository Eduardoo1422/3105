import { db } from '../db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export class AuthService {
  static async login(username: string, password: string) {
    const user = await db.user.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error('Invalid credentials');
    }
    const token = jwt.sign({ userId: user.id, role: user.role }, config.jwtSecret, { expiresIn: '24h' });
    return { token, user: { id: user.id, username: user.username, role: user.role } };
  }
}
