-- Create classifications table to store animal classification history
CREATE TABLE public.classifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  type TEXT NOT NULL CHECK (type IN ('cattle', 'buffalo')),
  breed TEXT NOT NULL,
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  traits JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_classifications_created_at ON public.classifications (created_at DESC);
CREATE INDEX idx_classifications_type ON public.classifications (type);
CREATE INDEX idx_classifications_user_id ON public.classifications (user_id);

-- Enable Row Level Security
ALTER TABLE public.classifications ENABLE ROW LEVEL SECURITY;

-- Allow public read and insert for demo purposes (no auth required initially)
CREATE POLICY "Anyone can view classifications"
ON public.classifications
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert classifications"
ON public.classifications
FOR INSERT
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE public.classifications IS 'Stores animal type classification results for cattle and buffalo';