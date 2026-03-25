-- Add missing DELETE policy for businesses table
CREATE POLICY "Users can delete own business"
  ON public.businesses FOR DELETE
  USING (auth.uid() = user_id);
