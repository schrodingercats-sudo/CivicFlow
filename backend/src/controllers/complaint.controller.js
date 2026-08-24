import { supabase } from '../config/supabase.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import { processComplaintAsync } from '../services/aiProcessor.js';
import { notifyAdminsSystem, notifyOfficersSystem, notifyCitizenSystem } from '../services/ntfy.service.js';

export const createComplaint = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category = 'others',
      priority = 'medium',
      latitude,
      longitude,
      address,
      image_url,
      department_id
    } = req.body;

    if (!title || !description || latitude === undefined || longitude === undefined || !address) {
      throw new ApiError(400, 'Title, description, latitude, longitude, and address are required fields');
    }

    let assignedDeptId = department_id;
    if (!assignedDeptId && category) {
      const { data: dept } = await supabase
        .from('cf_departments')
        .select('id')
        .eq('category', category)
        .single();
      if (dept) {
        assignedDeptId = dept.id;
      }
    }

    if (!assignedDeptId) {
      const { data: pwdDept } = await supabase
        .from('cf_departments')
        .select('id')
        .eq('code', 'DEPT_PWD')
        .single();
      if (pwdDept) {
        assignedDeptId = pwdDept.id;
      }
    }

    const { data: complaint, error } = await supabase
      .from('cf_complaints')
      .insert([
        {
          title,
          description,
          category,
          priority,
          status: 'submitted',
          ai_status: 'pending',
          latitude,
          longitude,
          address,
          image_url: image_url || null,
          citizen_id: req.user.id,
          department_id: assignedDeptId
        }
      ])
      .select('*, cf_departments(name, code), cf_users!cf_complaints_citizen_id_fkey(name, email)')
      .single();

    if (error || !complaint) {
      throw new ApiError(500, `Failed to submit complaint: ${error?.message || 'DB Error'}`);
    }

    await supabase.from('cf_complaint_updates').insert([
      {
        complaint_id: complaint.id,
        updated_by: req.user.id,
        old_status: null,
        new_status: 'submitted',
        remarks: 'Complaint submitted by citizen.'
      }
    ]);

    processComplaintAsync(complaint.id, title, description);

    // Notify admins and assigned officers (DB records + ntfy SSE push)
    await notifyAdminsSystem('New Complaint Submitted', `"${title}" at ${address || 'Unknown Location'}`, `/complaint/${complaint.id}`, 4);
    if (assignedDeptId) {
      await notifyOfficersSystem(assignedDeptId, 'New Complaint Assigned', `"${title}" assigned to department`, `/complaint/${complaint.id}`, 4);
    }

    return res.status(201).json(
      new ApiResponse(201, complaint, 'Complaint submitted successfully. AI triage processing in background.')
    );
  } catch (error) {
    next(error);
  }
};

export const getComplaints = async (req, res, next) => {
  try {
    const { status, category, priority, page = 1, limit = 20 } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from('cf_complaints')
      .select(
        '*, cf_departments(name, code), cf_users!cf_complaints_citizen_id_fkey(name, email), assigned_officer:cf_users!cf_complaints_assigned_officer_id_fkey(name, email)',
        { count: 'exact' }
      );

    if (req.user.role === 'citizen') {
      query = query.eq('citizen_id', req.user.id);
    } else if (req.user.role === 'officer') {
      if (req.user.department_id) {
        query = query.eq('department_id', req.user.department_id);
      } else {
        query = query.eq('assigned_officer_id', req.user.id);
      }
    }

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (priority) query = query.eq('priority', priority);

    query = query.order('created_at', { ascending: false }).range(offset, offset + limitNum - 1);

    const { data: complaints, error, count } = await query;

    if (error) {
      throw new ApiError(500, `Failed to fetch complaints: ${error.message}`);
    }

    return res.status(200).json(
      new ApiResponse(200, { complaints, total: count, page: Number(page), limit: Number(limit) }, 'Complaints retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

export const getComplaintById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: complaint, error } = await supabase
      .from('cf_complaints')
      .select(
        '*, cf_departments(name, code), citizen:cf_users!cf_complaints_citizen_id_fkey(name, email, phone), assigned_officer:cf_users!cf_complaints_assigned_officer_id_fkey(name, email, phone)'
      )
      .eq('id', id)
      .single();

    if (error || !complaint) {
      throw new ApiError(404, 'Complaint not found');
    }

    if (req.user.role === 'citizen' && complaint.citizen_id !== req.user.id) {
      throw new ApiError(403, 'Forbidden: You do not have permission to view this complaint');
    }

    const { data: timeline } = await supabase
      .from('cf_complaint_updates')
      .select('*, updater:cf_users!cf_complaint_updates_updated_by_fkey(name, role)')
      .eq('complaint_id', id)
      .order('created_at', { ascending: true });

    const { data: rating } = await supabase
      .from('cf_ratings')
      .select('*')
      .eq('complaint_id', id)
      .single();

    return res.status(200).json(
      new ApiResponse(200, { ...complaint, timeline: timeline || [], rating: rating || null }, 'Complaint detail retrieved')
    );
  } catch (error) {
    next(error);
  }
};

export const updateComplaintStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    let { status, remarks, proof_image_url, assigned_officer_id, department_id } = req.body;

    const { data: existingComplaint, error: fetchErr } = await supabase
      .from('cf_complaints')
      .select('id, title, status, citizen_id, department_id, assigned_officer_id')
      .eq('id', id)
      .single();

    if (fetchErr || !existingComplaint) {
      throw new ApiError(404, 'Complaint not found');
    }

    const updates = {};
    
    // Check if department is being reassigned
    const isDeptChanged = department_id && department_id !== existingComplaint.department_id;
    if (department_id !== undefined) {
      updates.department_id = department_id;
      if (isDeptChanged) {
        updates.assigned_officer_id = null; // Unassign previous officer on dept transfer
      }
    }

    // Automatically reactivate rejected or withdrawn complaints to 'submitted' upon department reassignment
    if ((existingComplaint.status === 'rejected' || existingComplaint.status === 'withdrawn') && (!status || status === existingComplaint.status)) {
      status = 'submitted';
    }

    if (status) updates.status = status;
    if (assigned_officer_id !== undefined && !isDeptChanged) {
      updates.assigned_officer_id = assigned_officer_id;
    }

    const { data: updatedComplaint, error: updateErr } = await supabase
      .from('cf_complaints')
      .update(updates)
      .eq('id', id)
      .select('*, cf_departments(name, code)')
      .single();

    if (updateErr) {
      throw new ApiError(500, `Failed to update complaint: ${updateErr.message}`);
    }

    const newStatus = updates.status || existingComplaint.status;

    // Log audit entry & send real-time notifications for status change OR department reassignment
    if (status || isDeptChanged) {
      await supabase.from('cf_complaint_updates').insert([
        {
          complaint_id: id,
          updated_by: req.user.id,
          old_status: existingComplaint.status,
          new_status: newStatus,
          remarks: remarks || (isDeptChanged ? `Reassigned to department: ${updatedComplaint.cf_departments?.name || department_id}` : `Status updated to ${newStatus}`),
          proof_image_url: proof_image_url || null
        }
      ]);

      // Automated notifications
      await notifyCitizenSystem(
        existingComplaint.citizen_id,
        isDeptChanged ? 'Complaint Reassigned' : `Status Update: ${newStatus.replaceAll('_', ' ').toUpperCase()}`,
        isDeptChanged 
          ? `Your complaint "${existingComplaint.title}" was reassigned to ${updatedComplaint.cf_departments?.name || 'a new department'}.`
          : `Your complaint "${existingComplaint.title}" status was updated to ${newStatus.replaceAll('_', ' ')}.`,
        `/complaint/${id}`
      );

      await notifyAdminsSystem(
        isDeptChanged ? 'Complaint Reassigned' : 'Complaint Status Changed',
        isDeptChanged 
          ? `"${existingComplaint.title}" reassigned to ${updatedComplaint.cf_departments?.name || department_id}.`
          : `"${existingComplaint.title}" status changed to ${newStatus.replaceAll('_', ' ')}.`,
        `/complaint/${id}`
      );

      const targetDeptId = updates.department_id || existingComplaint.department_id;
      if (targetDeptId) {
        await notifyOfficersSystem(
          targetDeptId,
          isDeptChanged ? 'New Complaint Reassigned To Dept' : 'Complaint Status Changed',
          `"${existingComplaint.title}" is assigned to your department queue.`,
          `/complaint/${id}`
        );
      }
    }

    return res.status(200).json(
      new ApiResponse(200, updatedComplaint, 'Complaint status updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

export const withdrawComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data: complaint, error: fetchErr } = await supabase
      .from('cf_complaints')
      .select('id, title, status, citizen_id')
      .eq('id', id)
      .single();

    if (fetchErr || !complaint) {
      throw new ApiError(404, 'Complaint not found');
    }

    if (complaint.citizen_id !== req.user.id && req.user.role !== 'admin') {
      throw new ApiError(403, 'Forbidden: You can only withdraw your own complaints');
    }

    if (complaint.status === 'closed' || complaint.status === 'resolved' || complaint.status === 'withdrawn') {
      throw new ApiError(400, 'Complaint is already resolved, closed, or withdrawn');
    }

    const { data: updatedComplaint, error: updateErr } = await supabase
      .from('cf_complaints')
      .update({ status: 'withdrawn' })
      .eq('id', id)
      .select('*, cf_departments(name, code)')
      .single();

    if (updateErr) {
      throw new ApiError(500, `Failed to withdraw complaint: ${updateErr.message}`);
    }

    await supabase.from('cf_complaint_updates').insert([
      {
        complaint_id: id,
        updated_by: req.user.id,
        old_status: complaint.status,
        new_status: 'withdrawn',
        remarks: reason ? `Complaint withdrawn by ${req.user.role}: ${reason}` : `Complaint withdrawn by ${req.user.role}.`
      }
    ]);

    // Automated notifications for citizen, admin, officer
    await notifyCitizenSystem(complaint.citizen_id, 'Complaint Withdrawn', `Your complaint "${complaint.title}" has been withdrawn.`, `/complaint/${id}`);
    await notifyAdminsSystem('Complaint Withdrawn', `"${complaint.title}" withdrawn by ${req.user.role}`, `/complaint/${id}`);

    return res.status(200).json(
      new ApiResponse(200, updatedComplaint, 'Complaint withdrawn successfully')
    );
  } catch (error) {
    next(error);
  }
};

export const rateComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating_score, feedback } = req.body;

    if (!rating_score || rating_score < 1 || rating_score > 5) {
      throw new ApiError(400, 'Rating score must be an integer between 1 and 5');
    }

    const { data: complaint } = await supabase
      .from('cf_complaints')
      .select('id, citizen_id, status')
      .eq('id', id)
      .single();

    if (!complaint) {
      throw new ApiError(404, 'Complaint not found');
    }

    if (complaint.citizen_id !== req.user.id) {
      throw new ApiError(403, 'Only the citizen who reported this complaint can rate it');
    }

    if (complaint.status !== 'resolved' && complaint.status !== 'closed') {
      throw new ApiError(400, 'Complaints can only be rated once resolved or closed');
    }

    const { data: rating, error } = await supabase
      .from('cf_ratings')
      .insert([
        {
          complaint_id: id,
          citizen_id: req.user.id,
          rating_score,
          feedback: feedback || null
        }
      ])
      .select('*')
      .single();

    if (error) {
      throw new ApiError(500, `Failed to save rating: ${error.message}`);
    }

    return res.status(201).json(
      new ApiResponse(201, rating, 'Rating submitted successfully')
    );
  } catch (error) {
    next(error);
  }
};

export const deleteComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: complaint, error: fetchErr } = await supabase
      .from('cf_complaints')
      .select('id, title, status, citizen_id, department_id')
      .eq('id', id)
      .single();

    if (fetchErr || !complaint) {
      throw new ApiError(404, 'Complaint not found');
    }

    // Citizens can only delete their own complaints in submitted status
    if (req.user.role === 'citizen') {
      if (complaint.citizen_id !== req.user.id) {
        throw new ApiError(403, 'You can only delete your own complaints');
      }
      if (complaint.status !== 'submitted') {
        throw new ApiError(400, 'Only complaints in submitted status can be deleted');
      }
    }

    // Cascade delete related records first
    await supabase.from('cf_ratings').delete().eq('complaint_id', id);
    await supabase.from('cf_complaint_updates').delete().eq('complaint_id', id);
    await supabase.from('cf_notifications').delete().eq('link_url', `/complaint/${id}`);

    const { error: deleteErr } = await supabase
      .from('cf_complaints')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      throw new ApiError(500, `Failed to delete complaint: ${deleteErr.message}`);
    }

    // Automated notifications
    await notifyAdminsSystem('Complaint Deleted', `"${complaint.title}" deleted by ${req.user.role}`, '/admin');
    if (req.user.role === 'admin') {
      await notifyCitizenSystem(complaint.citizen_id, 'Complaint Deleted', `Your complaint "${complaint.title}" was removed by admin`, '/citizen');
    }

    return res.status(200).json(
      new ApiResponse(200, null, 'Complaint deleted successfully')
    );
  } catch (error) {
    next(error);
  }
};
