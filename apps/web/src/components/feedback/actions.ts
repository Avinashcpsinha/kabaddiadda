'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';

const FEEDBACK_TYPES = ['working', 'not_working', 'idea', 'other'] as const;

const feedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  message: z.string().trim().min(5, 'Please share a bit more (5+ chars).').max(5000),
  email: z
    .string()
    .trim()
    .email('Invalid email.')
    .optional()
    .or(z.literal('')),
  page_url: z.string().max(2000).optional().or(z.literal('')),
});

export async function submitFeedbackAction(formData: FormData) {
  const parsed = feedbackSchema.safeParse({
    type: formData.get('type'),
    message: formData.get('message'),
    email: formData.get('email') ?? '',
    page_url: formData.get('page_url') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const user = await getSessionUser();
  const ua = (await headers()).get('user-agent') ?? '';

  const { error } = await supabase.from('feedback').insert({
    type: parsed.data.type,
    message: parsed.data.message,
    email: parsed.data.email || user?.email || null,
    user_id: user?.id ?? null,
    page_url: parsed.data.page_url || null,
    user_agent: ua,
  });

  if (error) return { error: error.message };
  return { success: 'Thanks! We got your feedback.' };
}
