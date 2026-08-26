import { supabase } from '../config/supabase.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import { ntfyTopics } from '../services/ntfy.service.js';

export const getNtfyTopic = async (req, res, next) => {
  try {
    const { role, id, department_id } = req.user;
    const topics = [];

    // Every user gets their personal citizen topic
    topics.push(ntfyTopics.citizen(id));

    if (role === 'admin') {
      topics.push(ntfyTopics.admin);
    }

    if (role === 'officer' && department_id) {
      topics.push(ntfyTopics.officer(department_id));
    }

    if (role === 'worker' && department_id) {
      topics.push(ntfyTopics.worker(department_id));
    }

    return res.status(200).json(
      new ApiResponse(200, { topics }, 'ntfy topics retrieved')
    );
  } catch (error) {
    next(error);
  }
};

export const getNotifications = async (req, res, next) => {
  try {
    const { data: notifications, error } = await supabase
      .from('cf_notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new ApiError(500, `Failed to fetch notifications: ${error.message}`);
    }

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return res.status(200).json(
      new ApiResponse(200, { notifications, unreadCount }, 'Notifications retrieved')
    );
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: notification, error } = await supabase
      .from('cf_notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('*')
      .single();

    if (error) {
      throw new ApiError(500, `Failed to update notification: ${error.message}`);
    }

    return res.status(200).json(
      new ApiResponse(200, notification, 'Notification marked as read')
    );
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('cf_notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id);

    if (error) {
      throw new ApiError(500, `Failed to mark all as read: ${error.message}`);
    }

    return res.status(200).json(
      new ApiResponse(200, null, 'All notifications marked as read')
    );
  } catch (error) {
    next(error);
  }
};
