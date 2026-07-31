import { ApiResponse } from '../utils/apiResponse.js';
import { supabase } from '../config/supabase.js';

export const getHealth = async (req, res, next) => {
  try {
    let dbStatus = 'disconnected';
    let departmentCount = 0;
    let dbError = null;

    const { data, error } = await supabase.from('cf_departments').select('id, name');

    if (!error && data) {
      dbStatus = 'connected';
      departmentCount = data.length;
    } else if (error) {
      dbError = error.message;
    }

    return res.status(200).json(
      new ApiResponse(200, {
        service: 'CivicFlow API',
        status: 'healthy',
        database: dbStatus,
        dbError: dbError,
        departmentsCount: departmentCount,
        timestamp: new Date().toISOString()
      }, 'System health verification successful')
    );
  } catch (error) {
    next(error);
  }
};
