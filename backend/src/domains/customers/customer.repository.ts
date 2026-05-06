import { supabase } from '../../lib/supabase';
import { Customer } from './customer.types';

export async function upsertByPhone(
  tenantId: string,
  phone: string,
  data: Partial<Customer>,
): Promise<Customer> {
  const { data: customer, error } = await supabase
    .from('customers')
    .upsert(
      { tenant_id: tenantId, phone_normalized: phone, ...data },
      { onConflict: 'tenant_id,phone_normalized' },
    )
    .select()
    .single();

  if (error) throw error;
  return customer;
}

export async function findByPhone(tenantId: string, phone: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('phone_normalized', phone)
    .single();

  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

export async function findById(id: string, tenantId?: string): Promise<Customer | null> {
  let query = supabase
    .from('customers')
    .select('*')
    .eq('id', id);

  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { data, error } = await query.single();

  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}
