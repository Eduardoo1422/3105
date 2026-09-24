import { Request, Response, NextFunction } from 'express';

// Create a test admin user JWT token
export const createTestToken = (userId: string = 'admin-test-user') => {
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'test-jwt-secret-key-with-at-least-32-chars';
  return jwt.sign({ userId, role: 'ADMIN' }, secret, { expiresIn: '1h' });
};

// Create a non-admin user JWT token
export const createTestUserToken = (userId: string = 'regular-user') => {
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'test-jwt-secret-key-with-at-least-32-chars';
  return jwt.sign({ userId, role: 'USER' }, secret, { expiresIn: '1h' });
};

// Create mock auth middleware result
export const mockAuthUser = (userId: string = 'admin-test-user', role: string = 'ADMIN') => {
  return { userId, role };
};

// Mock Request object
export const mockRequest = (body: any = {}, params: any = {}, file?: any) => {
  return {
    body,
    params,
    file,
    files: file ? [file] : undefined,
    headers: {},
    user: undefined
  } as unknown as Request;
};

// Mock Response object
export const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.download = jest.fn().mockImplementation((filePath, filename, cb) => {
    cb(null);
  });
  return res;
};
