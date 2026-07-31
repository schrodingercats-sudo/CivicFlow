import { supabase } from '../config/supabase.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';

export const getAdminStats = async (req, res, next) => {
  try {
    const { data: complaints, error: compErr } = await supabase
      .from('cf_complaints')
      .select('id, status, category, priority, created_at, department_id');

    if (compErr) {
      throw new ApiError(500, `Failed to query complaint metrics: ${compErr.message}`);
    }

    const { data: users } = await supabase.from('cf_users').select('id, role');
    const { data: departments } = await supabase.from('cf_departments').select('id, name, code, category');

    const totalComplaints = complaints.length;
    const submitted = complaints.filter(c => c.status === 'submitted').length;
    const inProgress = complaints.filter(c => c.status === 'in_progress' || c.status === 'under_review' || c.status === 'assigned').length;
    const resolved = complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length;
    const rejected = complaints.filter(c => c.status === 'rejected').length;

    const resolutionRate = totalComplaints > 0 ? Math.round((resolved / totalComplaints) * 100) : 0;

    // Category breakdown
    const categoryCounts = {};
    complaints.forEach(c => {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    });

    // Department Performance breakdown
    const departmentStats = (departments || []).map(dept => {
      const deptComplaints = complaints.filter(c => c.department_id === dept.id);
      return {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        category: dept.category,
        total: deptComplaints.length,
        resolved: deptComplaints.filter(c => c.status === 'resolved' || c.status === 'closed').length,
        pending: deptComplaints.filter(c => c.status !== 'resolved' && c.status !== 'closed').length
      };
    });

    return res.status(200).json(
      new ApiResponse(200, {
        summary: {
          totalComplaints,
          submitted,
          inProgress,
          resolved,
          rejected,
          resolutionRate,
          totalUsers: users?.length || 0,
          totalOfficers: users?.filter(u => u.role === 'officer').length || 0,
          totalDepartments: departments?.length || 0
        },
        categoryDistribution: categoryCounts,
        departmentStats
      }, 'Admin analytics metrics fetched successfully')
    );
  } catch (error) {
    next(error);
  }
};
