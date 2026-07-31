import { logger } from '../utils/logger.js';
import { supabase } from '../config/supabase.js';

// Random suffix topics for security (public ntfy.sh)
const TOPICS = {
  admin: `civicflow-admin-${process.env.NTFY_SECRET || 'x9k2m7p4'}`,
  officer: (deptId) => `civicflow-officer-${deptId || 'all'}-${process.env.NTFY_SECRET || 'x9k2m7p4'}`,
  citizen: (userId) => `civicflow-citizen-${userId}-${process.env.NTFY_SECRET || 'x9k2m7p4'}`
};

export const ntfyTopics = TOPICS;

export const publishNtfy = async (topic, title, message, priority = 3, tags = ['civicflow']) => {
  try {
    const res = await fetch('https://ntfy.sh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        title,
        message: typeof message === 'object' ? JSON.stringify(message) : message,
        priority,
        tags
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.warn(`ntfy publish failed (${res.status}): ${errText}`);
      return null;
    }

    const data = await res.json();
    logger.info(`ntfy sent to ${topic}: ${title}`);
    return data;
  } catch (err) {
    // Non-blocking: ntfy failure should never break complaint flow
    logger.warn(`ntfy publish error: ${err.message}`);
    return null;
  }
};

export const notifyAdmin = (title, message, priority = 3) =>
  publishNtfy(TOPICS.admin, title, message, priority, ['civicflow', 'admin']);

export const notifyOfficer = (deptId, title, message, priority = 3) =>
  publishNtfy(TOPICS.officer(deptId), title, message, priority, ['civicflow', 'officer']);

export const notifyCitizen = (userId, title, message, priority = 3) =>
  publishNtfy(TOPICS.citizen(userId), title, message, priority, ['civicflow', 'citizen']);

/**
 * Unified notification helper that creates DB records (cf_notifications) AND triggers ntfy SSE push
 */
export const notifyAdminsSystem = async (title, message, linkUrl = '/admin', priority = 3) => {
  try {
    const { data: admins } = await supabase
      .from('cf_users')
      .select('id')
      .eq('role', 'admin');

    if (admins && admins.length > 0) {
      const inserts = admins.map(a => ({
        user_id: a.id,
        title,
        message,
        link_url: linkUrl
      }));
      await supabase.from('cf_notifications').insert(inserts);
    }
  } catch (err) {
    logger.warn(`Failed to insert admin notifications: ${err.message}`);
  }

  return notifyAdmin(title, message, priority);
};

export const notifyOfficersSystem = async (deptId, title, message, linkUrl = '/officer', priority = 3) => {
  try {
    let query = supabase.from('cf_users').select('id').eq('role', 'officer');
    if (deptId) {
      query = query.eq('department_id', deptId);
    }
    const { data: officers } = await query;

    if (officers && officers.length > 0) {
      const inserts = officers.map(o => ({
        user_id: o.id,
        title,
        message,
        link_url: linkUrl
      }));
      await supabase.from('cf_notifications').insert(inserts);
    }
  } catch (err) {
    logger.warn(`Failed to insert officer notifications: ${err.message}`);
  }

  return notifyOfficer(deptId, title, message, priority);
};

export const notifyCitizenSystem = async (userId, title, message, linkUrl = '/citizen', priority = 3) => {
  try {
    await supabase.from('cf_notifications').insert([
      {
        user_id: userId,
        title,
        message,
        link_url: linkUrl
      }
    ]);
  } catch (err) {
    logger.warn(`Failed to insert citizen notification: ${err.message}`);
  }

  return notifyCitizen(userId, title, message, priority);
};
