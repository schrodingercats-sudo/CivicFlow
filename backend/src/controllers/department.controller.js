import { supabase } from '../config/supabase.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';

export const getDepartments = async (req, res, next) => {
  try {
    const { data: departments, error } = await supabase
      .from('cf_departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new ApiError(500, `Failed to fetch departments: ${error.message}`);
    }

    return res.status(200).json(
      new ApiResponse(200, departments, 'Departments fetched successfully')
    );
  } catch (error) {
    next(error);
  }
};
