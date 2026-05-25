'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';

const demoRequestSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name.').max(200),
  mobile: z
    .string()
    .trim()
    .min(5, 'Please enter a valid mobile/WhatsApp number.')
    .max(40)
    .regex(/^[+\d][\d\s().-]{4,}$/, 'Mobile number looks invalid.'),
  email: z.string().trim().email('Invalid email.').max(320),
  organisation: z.string().trim().min(1, 'Please enter your organisation.').max(200),
  social_link: z
    .string()
    .trim()
    .max(500)
    .url('Social link must be a valid URL (include https://).')
    .optional()
    .or(z.literal('')),
  page_url: z.string().max(2000).optional().or(z.literal('')),
});

export async function submitDemoRequestAction(formData: FormData) {
  const parsed = demoRequestSchema.safeParse({
    name: formData.get('name'),
    mobile: formData.get('mobile'),
    email: formData.get('email'),
    organisation: formData.get('organisation'),
    social_link: formData.get('social_link') ?? '',
    page_url: formData.get('page_url') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const user = await getSessionUser();
  const ua = (await headers()).get('user-agent') ?? '';

  const { error } = await supabase.from('demo_requests').insert({
    name: parsed.data.name,
    mobile: parsed.data.mobile,
    email: parsed.data.email,
    organisation: parsed.data.organisation,
    social_link: parsed.data.social_link || null,
    page_url: parsed.data.page_url || null,
    user_agent: ua,
    user_id: user?.id ?? null,
  });

  if (error) return { error: error.message };
  return { success: "Thanks! We'll reach out within one business day." };
}
