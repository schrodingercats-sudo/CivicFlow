import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';

const JWT_SECRET = process.env.JWT_SECRET;

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const register = async (req, res, next) => {
  try {
    let { name, email, phone, role = 'citizen', department_id } = req.body;

    email = email?.trim().toLowerCase();
    role = role?.toLowerCase() || 'citizen';

    let callerRole = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { data: callerUser } = await supabase
          .from('cf_users')
          .select('role')
          .eq('id', decoded.id)
          .single();
        callerRole = callerUser?.role || null;
      } catch (err) {
        callerRole = null;
      }
    }

    if (callerRole !== 'admin') {
      role = 'citizen';
    }

    if (!name || !email) {
      throw new ApiError(400, 'Name and Email are required');
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('cf_users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new ApiError(409, 'User with this email already exists');
    }

    // Insert user into cf_users
    const { data: newUser, error } = await supabase
      .from('cf_users')
      .insert([
        {
          name,
          email,
          phone: phone || null,
          role: role,
          department_id: department_id || null
        }
      ])
      .select('*, cf_departments(name, code)')
      .single();

    if (error || !newUser) {
      throw new ApiError(500, `Failed to register user: ${error?.message || 'Database error'}`);
    }

    const token = generateToken(newUser);

    return res.status(201).json(
      new ApiResponse(201, { user: newUser, token }, 'User registered successfully')
    );
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    let { email } = req.body;
    email = email?.trim().toLowerCase();

    if (!email) {
      throw new ApiError(400, 'Email is required');
    }

    const { data: user, error } = await supabase
      .from('cf_users')
      .select('*, cf_departments(name, code)')
      .eq('email', email)
      .single();

    if (user && user.active === false) {
      throw new ApiError(403, 'Account is deactivated. Contact your administrator.');
    }

    if (error || !user) {
      throw new ApiError(404, 'User not found. Please check your email or register.');
    }

    const token = generateToken(user);

    return res.status(200).json(
      new ApiResponse(200, { user, token }, 'Login successful')
    );
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    return res.status(200).json(
      new ApiResponse(200, { user: req.user }, 'Current user profile fetched')
    );
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;

    const { data: updatedUser, error } = await supabase
      .from('cf_users')
      .update(updates)
      .eq('id', req.user.id)
      .select('*, cf_departments(name, code)')
      .single();

    if (error || !updatedUser) {
      throw new ApiError(500, `Failed to update profile: ${error?.message || 'Database error'}`);
    }

    return res.status(200).json(
      new ApiResponse(200, { user: updatedUser }, 'Profile updated successfully')
    );
  } catch (error) {
    next(error);
  }
};
