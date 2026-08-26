import { supabase } from '../config/supabase.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';
import { notifyCitizenSystem } from '../services/ntfy.service.js';

export const listWorkers = async (req, res, next) => {
  try {
    let query = supabase
      .from('cf_users')
      .select('id, name, email, phone, department_id, active, created_at, cf_departments(name, code)')
      .eq('role', 'worker');

    if (req.user.role === 'officer' && req.user.department_id) {
      query = query.eq('department_id', req.user.department_id);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new ApiError(500, error.message);
    }

    return res.status(200).json(
      new ApiResponse(200, { workers: data || [] }, 'Workers list fetched')
    );
  } catch (error) {
    next(error);
  }
};

export const updateWorker = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, department_id } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (department_id && req.user.role === 'admin') updates.department_id = department_id;

    const { data, error } = await supabase
      .from('cf_users')
      .update(updates)
      .eq('id', id)
      .eq('role', 'worker')
      .select('*')
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return res.status(200).json(
      new ApiResponse(200, { worker: data }, 'Worker updated')
    );
  } catch (error) {
    next(error);
  }
};

export const toggleWorkerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    const { data, error } = await supabase
      .from('cf_users')
      .update({ active: !!active })
      .eq('id', id)
      .eq('role', 'worker')
      .select('*')
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return res.status(200).json(
      new ApiResponse(200, { worker: data }, `Worker marked ${active ? 'active' : 'inactive'}`)
    );
  } catch (error) {
    next(error);
  }
};

export const deleteWorker = async (req, res, next) => {
  try {
    const { id } = req.params;

    await supabase
      .from('cf_complaints')
      .update({ assigned_worker_id: null })
      .eq('assigned_worker_id', id);

    const { error } = await supabase
      .from('cf_users')
      .delete()
      .eq('id', id)
      .eq('role', 'worker');

    if (error) {
      throw new ApiError(500, error.message);
    }

    return res.status(200).json(
      new ApiResponse(200, {}, 'Worker deleted')
    );
  } catch (error) {
    next(error);
  }
};

export const getWorkerTasks = async (req, res, next) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('cf_complaints')
      .select('*, cf_departments(name, code), cf_users!cf_complaints_citizen_id_fkey(name, email)')
      .eq('assigned_worker_id', req.user.id);

    if (status) query = query.eq('status', status);
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new ApiError(500, error.message);
    }

    return res.status(200).json(
      new ApiResponse(200, { tasks: data || [] }, 'Worker tasks fetched')
    );
  } catch (error) {
    next(error);
  }
};

export const submitWorkerUpdate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { update_type, remarks, proof_image_url, geo_image_url, latitude, longitude } = req.body;

    if (!update_type || !remarks) {
      throw new ApiError(400, 'update_type and remarks are required');
    }

    const { data: complaint } = await supabase
      .from('cf_complaints')
      .select('id, title, citizen_id, assigned_worker_id, status')
      .eq('id', id)
      .single();

    if (!complaint) {
      throw new ApiError(404, 'Task not found');
    }
    if (complaint.assigned_worker_id !== req.user.id) {
      throw new ApiError(403, 'This task is not assigned to you');
    }

    const { data, error } = await supabase
      .from('cf_worker_updates')
      .insert([{
        complaint_id: id,
        worker_id: req.user.id,
        update_type,
        remarks,
        proof_image_url: proof_image_url || null,
        geo_image_url: geo_image_url || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null
      }])
      .select('*')
      .single();

    if (error) {
      throw new ApiError(500, `Update failed: ${error.message}`);
    }

    if (update_type === 'completed') {
      await supabase
        .from('cf_complaints')
        .update({ status: 'resolved' })
        .eq('id', id);

      await supabase
        .from('cf_complaint_updates')
        .insert([{
          complaint_id: id,
          updated_by: req.user.id,
          old_status: complaint.status,
          new_status: 'resolved',
          remarks: `Work completed by field worker: ${remarks}`,
          proof_image_url: proof_image_url || null
        }]);

      if (complaint.citizen_id) {
        const resolveMsg = `Your complaint "${complaint.title}" has been resolved by field worker.`;
        await notifyCitizenSystem(
          complaint.citizen_id,
          'Complaint Resolved',
          resolveMsg,
          `/complaint/${id}`
        );
      }
    } else if (update_type === 'accepted' || update_type === 'in_progress') {
      const newStatus = 'in_progress';
      await supabase
        .from('cf_complaints')
        .update({ status: newStatus })
        .eq('id', id);

      await supabase
        .from('cf_complaint_updates')
        .insert([{
          complaint_id: id,
          updated_by: req.user.id,
          old_status: complaint.status,
          new_status: newStatus,
          remarks: `Worker update (${update_type}): ${remarks}`
        }]);
    }

    return res.status(201).json(
      new ApiResponse(201, { update: data }, 'Worker update submitted')
    );
  } catch (error) {
    next(error);
  }
};
