import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import { ApiError } from '../utils/apiError.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Unauthorized: No token provided');
    }

    const token = authHeader.split(' ')[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'civicflow-super-secret-jwt-key-2026');
    } catch (err) {
      throw new ApiError(401, 'Unauthorized: Invalid or expired token');
    }

    const { data: user, error } = await supabase
      .from('cf_users')
      .select('*, cf_departments(name, code)')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      throw new ApiError(401, 'Unauthorized: User account not found');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
