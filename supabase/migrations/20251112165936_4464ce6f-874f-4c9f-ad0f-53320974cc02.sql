-- Add winner_class_id to sibling_discount_state table
-- This tracks which specific class receives the sibling discount for multi-enrollment students

ALTER TABLE sibling_discount_state 
ADD COLUMN winner_class_id UUID REFERENCES classes(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sibling_discount_state_winner_class 
ON sibling_discount_state(winner_class_id) 
WHERE winner_class_id IS NOT NULL;