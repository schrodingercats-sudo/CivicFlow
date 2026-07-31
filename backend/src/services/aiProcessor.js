import { AIService } from './ai.service.js';
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export const processComplaintAsync = async (complaintId, title, description) => {
  try {
    logger.info(`Starting async AI processing for complaint ${complaintId}`);

    const aiResult = await AIService.analyzeComplaint(title, description);

    // Lookup matching department for AI predicted category
    let deptId = null;
    if (aiResult.category) {
      const { data: dept } = await supabase
        .from('cf_departments')
        .select('id')
        .eq('category', aiResult.category)
        .single();
      if (dept) deptId = dept.id;
    }

    const updates = {
      category: aiResult.category || 'others',
      priority: aiResult.priority || 'medium',
      ai_status: aiResult.needs_manual_review ? 'failed' : 'completed',
      needs_manual_review: !!aiResult.needs_manual_review,
      ai_summary: aiResult.ai_summary,
      ai_suggested_response: aiResult.ai_suggested_response,
      ai_confidence: aiResult.ai_confidence
    };

    if (deptId) {
      updates.department_id = deptId;
    }

    const { error } = await supabase
      .from('cf_complaints')
      .update(updates)
      .eq('id', complaintId);

    if (error) {
      logger.error(`Failed to update DB with AI result for complaint ${complaintId}: ${error.message}`);
    } else {
      logger.info(`Complaint ${complaintId} successfully updated with AI triage (${aiResult.provider})`);
    }
  } catch (err) {
    logger.error(`Unhandled error in processComplaintAsync for ${complaintId}: ${err.message}`);
    await supabase.from('cf_complaints').update({
      ai_status: 'failed',
      needs_manual_review: true
    }).eq('id', complaintId);
  }
};
