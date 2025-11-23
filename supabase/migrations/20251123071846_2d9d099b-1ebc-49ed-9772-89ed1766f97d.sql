-- Clear existing avatars and insert new ones
DELETE FROM public.avatars;

-- Insert 10 new avatars (all standard/free)
INSERT INTO public.avatars (name, image_url, is_premium, display_order, is_active) VALUES
('Lion', '/src/assets/avatars/avatar-003.png', false, 1, true),
('Cupcake', '/src/assets/avatars/avatar-006.png', false, 2, true),
('Car', '/src/assets/avatars/avatar-007.png', false, 3, true),
('Blue Friend', '/src/assets/avatars/avatar-009.png', false, 4, true),
('Chick', '/src/assets/avatars/avatar-018.png', false, 5, true),
('Pear', '/src/assets/avatars/avatar-025.png', false, 6, true),
('Green Friend', '/src/assets/avatars/avatar-050.png', false, 7, true),
('Sunshine', '/src/assets/avatars/avatar-051.png', false, 8, true),
('Flower', '/src/assets/avatars/avatar-054.png', false, 9, true),
('Penguin', '/src/assets/avatars/avatar-055.png', false, 10, true);