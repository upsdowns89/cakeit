'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function registerShop(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다.' };
  }

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const address = formData.get('address') as string;
  const businessHours = formData.get('business_hours') as string | null;

  // Handle image upload
  let imageUrl: string | null = null;
  const imageFile = formData.get('image') as File | null;

  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('shop-images')
      .upload(fileName, imageFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return { error: `이미지 업로드 실패: ${uploadError.message}` };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('shop-images').getPublicUrl(uploadData.path);

    imageUrl = publicUrl;
  }

  // Insert shop record
  const { error: shopError } = await supabase.from('shops').insert({
    owner_id: user.id,
    name,
    description,
    address,
    image_url: imageUrl,
    business_hours: businessHours ? JSON.parse(businessHours) : null,
  });

  if (shopError) {
    return { error: shopError.message };
  }

  redirect('/seller');
}

export async function updateShop(shopId: string, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다.' };
  }

  const updates: Record<string, unknown> = {
    name: formData.get('name') as string,
    description: formData.get('description') as string,
    address: formData.get('address') as string,
  };

  const businessHours = formData.get('business_hours') as string | null;
  if (businessHours) {
    updates.business_hours = JSON.parse(businessHours);
  }

  // Handle image upload if new file provided
  const imageFile = formData.get('image') as File | null;
  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('shop-images')
      .upload(fileName, imageFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return { error: `이미지 업로드 실패: ${uploadError.message}` };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('shop-images').getPublicUrl(uploadData.path);

    updates.image_url = publicUrl;
  }

  const { error } = await supabase
    .from('shops')
    .update(updates)
    .eq('id', shopId)
    .eq('owner_id', user.id);

  if (error) {
    return { error: error.message };
  }

  redirect('/seller');
}
