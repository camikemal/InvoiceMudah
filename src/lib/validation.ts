import { z } from 'zod';

const optionalEmail = z
  .string()
  .trim()
  .refine(v => v === '' || z.email().safeParse(v).success, 'Please enter a valid customer email.')
  .nullish();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date.');

export const invoiceItemSchema = z.object({
  item_name: z.string().trim().min(1, 'Every item needs a name.'),
  quantity: z.number().finite('Quantity must be a number.').min(0, 'Quantity cannot be negative.'),
  price: z.number().finite('Price must be a number.').min(0, 'Price cannot be negative.'),
});

export const invoiceSchema = z
  .object({
    invoice_number: z.string().trim().min(1, 'Invoice number is required.'),
    invoice_date: isoDate,
    customer_name: z.string().trim().min(1, 'Please enter a customer name.'),
    customer_email: optionalEmail,
    discount: z.number().finite('Discount must be a number.').min(0, 'Discount cannot be negative.'),
    subtotal: z.number(),
    due_date: isoDate.nullish(),
    items: z.array(invoiceItemSchema).min(1, 'Add at least one item.'),
  })
  .refine(v => v.discount <= v.subtotal, {
    message: 'Discount cannot be more than the sub total.',
    path: ['discount'],
  })
  .refine(v => !v.due_date || v.due_date >= v.invoice_date, {
    message: 'Due date cannot be before the invoice date.',
    path: ['due_date'],
  });

export const businessSchema = z.object({
  name: z.string().trim().min(1, 'Business name is required.').max(120, 'Business name is too long.'),
  phone: z.string().trim().max(40, 'Phone number is too long.'),
  account_number: z
    .string()
    .trim()
    .regex(/^[0-9\s-]*$/, 'Account number should only contain digits.'),
  default_due_days: z
    .number()
    .int('Due days must be a whole number.')
    .min(0, 'Due days cannot be negative.')
    .max(365, 'Due days cannot exceed 365.'),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required.'),
  email: optionalEmail,
  phone: z.string().trim().max(40, 'Phone number is too long.').nullish(),
});

export const paymentSchema = z.object({
  amount: z.number().finite('Amount must be a number.').positive('Amount must be more than 0.'),
  paid_at: isoDate,
});

/** Validate and return the first error message, or null if valid */
export function firstError<T>(schema: z.ZodType<T>, value: unknown): string | null {
  const result = schema.safeParse(value);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? 'Invalid input.';
}
